#!/usr/bin/env bash

# Instalação inicial da AutoFin em uma conta cPanel/WHM com Application Manager/Passenger.
# Execute como o usuário da conta cPanel, dentro da raiz do repositório já clonado.

set -Eeuo pipefail
IFS=$'\n\t'

readonly SCRIPT_NAME="$(basename "$0")"
readonly PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly DEFAULT_DB_SUFFIX="autofin"
readonly DEFAULT_DB_USER_SUFFIX="autoapp"
readonly ENV_DIR="$HOME/.config/autofin"
readonly ENV_FILE="$ENV_DIR/autofin.env"

GREEN="\033[0;32m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
RESET="\033[0m"

info() { printf "${GREEN}[AutoFin]${RESET} %s\n" "$*"; }
warn() { printf "${YELLOW}[Atenção]${RESET} %s\n" "$*"; }
fail() { printf "${RED}[Erro]${RESET} %s\n" "$*" >&2; exit 1; }

show_help() {
  cat <<'EOF'
Uso: bash scripts/install-cpanel-whm.sh

Execute dentro da raiz do projeto, como o usuário da conta cPanel.
O instalador cria um banco MySQL, usuário com privilégios de migração, arquivo privado
de ambiente, aplica as migrações, gera o build e prepara o restart do Passenger.

Pré-requisitos do WHM: ea-nodejs22, ea-apache24-mod-passenger,
ea-apache24-mod_env e Application Manager habilitado para a conta.
EOF
}

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  show_help
  exit 0
fi

[[ "${EUID}" -ne 0 ]] || fail "Não execute como root. Use o usuário da conta cPanel."
[[ -f "$PROJECT_DIR/package.json" ]] || fail "package.json não encontrado em $PROJECT_DIR."
command -v uapi >/dev/null 2>&1 || fail "UAPI não encontrada. Execute em uma conta cPanel com acesso a UAPI."
command -v openssl >/dev/null 2>&1 || fail "openssl não está disponível."

if [[ -x "/opt/cpanel/ea-nodejs22/bin/node" ]]; then
  export PATH="/opt/cpanel/ea-nodejs22/bin:$HOME/.local/bin:$PATH"
fi

command -v node >/dev/null 2>&1 || fail "Node.js não encontrado. Habilite ea-nodejs22 no WHM."
NODE_MAJOR="$(node --version | sed -E 's/^v([0-9]+).*/\1/')"
[[ "$NODE_MAJOR" -ge 22 ]] || fail "Node.js 22 ou superior é necessário; encontrado: $(node --version)."

command -v corepack >/dev/null 2>&1 || fail "Corepack não encontrado na instalação Node.js."
mkdir -p "$HOME/.local/bin"
corepack enable --install-directory "$HOME/.local/bin"
corepack prepare pnpm@10.15.1 --activate
command -v pnpm >/dev/null 2>&1 || fail "pnpm não foi disponibilizado pelo Corepack."

read -r -p "Sufixo do banco [${DEFAULT_DB_SUFFIX}]: " DB_SUFFIX
DB_SUFFIX="${DB_SUFFIX:-$DEFAULT_DB_SUFFIX}"
read -r -p "Sufixo do usuário MySQL [${DEFAULT_DB_USER_SUFFIX}]: " DB_USER_SUFFIX
DB_USER_SUFFIX="${DB_USER_SUFFIX:-$DEFAULT_DB_USER_SUFFIX}"

[[ "$DB_SUFFIX" =~ ^[A-Za-z0-9_]{1,32}$ ]] || fail "O sufixo do banco contém caracteres inválidos."
[[ "$DB_USER_SUFFIX" =~ ^[A-Za-z0-9_]{1,24}$ ]] || fail "O sufixo do usuário contém caracteres inválidos."

read -r -p "Criar banco e usuário MySQL, aplicar migrações e gerar build? [s/N]: " CONFIRM
[[ "$CONFIRM" =~ ^[sS]$ ]] || { info "Instalação cancelada."; exit 0; }

MYSQL_PASSWORD="$(openssl rand -hex 24)"
JWT_SECRET="$(openssl rand -hex 48)"
SETUP_TOKEN="$(openssl rand -hex 32)"

info "Criando o banco MySQL pelo UAPI do cPanel..."
uapi Mysql create_database name="$DB_SUFFIX" >/dev/null
uapi Mysql create_user name="$DB_USER_SUFFIX" password="$MYSQL_PASSWORD" >/dev/null

# Em instalações padrão, o cPanel acrescenta o prefixo de usuário a bancos e contas MySQL.
# O comando abaixo localiza os nomes completos criados na resposta da UAPI.
find_prefixed_name() {
  local kind="$1"
  local suffix="$2"
  local output
  output="$(uapi --output=json Mysql "list_${kind}")"
  node -e '
    const fs = require("fs");
    const suffix = process.argv[1];
    const values = new Set();
    const walk = (value) => {
      if (typeof value === "string") values.add(value);
      else if (Array.isArray(value)) value.forEach(walk);
      else if (value && typeof value === "object") Object.values(value).forEach(walk);
    };
    walk(JSON.parse(fs.readFileSync(0, "utf8")));
    const candidates = [...values].filter((value) => value === suffix || value.endsWith(`_${suffix}`));
    const unique = [...new Set(candidates)];
    if (unique.length !== 1) {
      console.error(`Não foi possível identificar de forma única o nome com sufixo ${suffix}: ${unique.join(", ") || "nenhum"}`);
      process.exit(2);
    }
    process.stdout.write(unique[0]);
  ' "$suffix" <<<"$output"
}

DB_NAME="$(find_prefixed_name databases "$DB_SUFFIX")"
DB_USER="$(find_prefixed_name users "$DB_USER_SUFFIX")"

info "Concedendo permissões de migração ao usuário MySQL..."
uapi Mysql set_privileges_on_database user="$DB_USER" database="$DB_NAME" privileges="ALL PRIVILEGES" >/dev/null

umask 077
mkdir -p "$ENV_DIR"
cat >"$ENV_FILE" <<EOF
NODE_ENV=production
DATABASE_URL=mysql://${DB_USER}:${MYSQL_PASSWORD}@localhost/${DB_NAME}
JWT_SECRET=${JWT_SECRET}
LOCAL_ADMIN_SETUP_TOKEN=${SETUP_TOKEN}
EOF
chmod 600 "$ENV_FILE"

info "Instalando dependências congeladas..."
cd "$PROJECT_DIR"
pnpm install --frozen-lockfile

info "Aplicando migrações..."
set -a
# shellcheck source=/dev/null
. "$ENV_FILE"
set +a
pnpm exec drizzle-kit migrate

info "Gerando build de produção..."
pnpm build
mkdir -p "$PROJECT_DIR/tmp"
touch "$PROJECT_DIR/tmp/restart.txt"

cat <<EOF

${GREEN}Instalação local concluída.${RESET}

Próximo passo no cPanel:
1. Abra Software → Application Manager → Register Application.
2. Selecione seu domínio, Base Application URL '/', Application Path '${PROJECT_DIR#$HOME/}', ambiente Production.
3. Clique em Deploy. O app.js carregará automaticamente $ENV_FILE.
4. Ao criar o primeiro administrador em "Acesso do dono", use este token uma única vez:

${YELLOW}${SETUP_TOKEN}${RESET}

Guarde-o em um gerenciador de senhas. Depois do primeiro cadastro, remova a linha
LOCAL_ADMIN_SETUP_TOKEN de $ENV_FILE e execute: touch "$PROJECT_DIR/tmp/restart.txt"

O arquivo de segredos tem permissão 600 e não foi incluído no repositório.
EOF
