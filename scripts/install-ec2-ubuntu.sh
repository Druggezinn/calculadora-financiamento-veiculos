#!/usr/bin/env bash

# Instalação inicial da AutoFin em Ubuntu 24.04 na Amazon EC2.
# Execute como: sudo bash scripts/install-ec2-ubuntu.sh

set -Eeuo pipefail
IFS=$'\n\t'

readonly APP_NAME="autofin"
readonly APP_USER="autofin"
readonly APP_DIR="/srv/${APP_NAME}"
readonly CONFIG_DIR="/etc/${APP_NAME}"
readonly CONFIG_FILE="${CONFIG_DIR}/${APP_NAME}.config"
readonly SERVICE_FILE="/etc/systemd/system/${APP_NAME}.service"
readonly NGINX_FILE="/etc/nginx/sites-available/${APP_NAME}"
readonly NODE_MAJOR="20"

GREEN="\033[0;32m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
RESET="\033[0m"

info() { printf "${GREEN}[AutoFin]${RESET} %s\n" "$*"; }
warn() { printf "${YELLOW}[Atenção]${RESET} %s\n" "$*"; }
fail() { printf "${RED}[Erro]${RESET} %s\n" "$*" >&2; exit 1; }

show_help() {
  cat <<'EOF'
Uso: sudo bash scripts/install-ec2-ubuntu.sh

Instala a AutoFin em Ubuntu 24.04/22.04 com Node.js 20, pnpm, MySQL local,
Nginx, systemd e HTTPS opcional via Certbot.

Antes de executar:
  1. Crie uma instância EC2 Ubuntu com ao menos 2 GB de RAM.
  2. No Security Group da AWS, libere SSH (22) apenas para seu IP e HTTP/HTTPS (80/443).
  3. Configure uma chave SSH no usuário que executará este script para clonar repositórios Git privados.
  4. Aponte o DNS do domínio à instância se desejar emitir HTTPS agora.

O script é destinado à primeira instalação e interrompe se /srv/autofin já contiver arquivos.
EOF
}

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  show_help
  exit 0
fi

[[ "${EUID}" -eq 0 ]] || fail "Execute como root via sudo: sudo bash scripts/install-ec2-ubuntu.sh"
[[ -f "package.json" ]] || fail "Execute o script a partir da raiz do repositório AutoFin."

CALLER="${SUDO_USER:-}"
[[ -n "$CALLER" && "$CALLER" != "root" ]] || fail "Execute pelo usuário SSH normal com sudo, não diretamente como root."

read -r -p "URL Git do projeto (ex.: git@github.com:conta/repo.git): " REPOSITORY_URL
[[ -n "$REPOSITORY_URL" ]] || fail "A URL do repositório é obrigatória."

read -r -p "Domínio da AutoFin (ex.: autofin.seudominio.com): " DOMAIN
[[ "$DOMAIN" =~ ^[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]] || fail "Informe um domínio válido, sem http:// nem caminhos."

read -r -p "E-mail para renovação do Let's Encrypt: " CERT_EMAIL
[[ "$CERT_EMAIL" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]] || fail "Informe um e-mail válido."

read -r -p "Emitir HTTPS agora? O DNS já deve apontar para esta EC2 [s/N]: " ENABLE_TLS

if [[ -e "$APP_DIR" ]] && [[ -n "$(find "$APP_DIR" -mindepth 1 -maxdepth 1 -print -quit 2>/dev/null)" ]]; then
  fail "$APP_DIR já contém arquivos. O instalador evita sobrescrever uma instalação existente."
fi

info "Atualizando Ubuntu e instalando dependências do sistema..."
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get upgrade -y
apt-get install -y ca-certificates curl git build-essential ufw nginx mysql-server certbot python3-certbot-nginx

info "Instalando Node.js ${NODE_MAJOR} e pnpm..."
curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" -o /tmp/autofin-nodesource.sh
bash /tmp/autofin-nodesource.sh
rm -f /tmp/autofin-nodesource.sh
apt-get install -y nodejs

if command -v corepack >/dev/null 2>&1; then
  corepack enable
  corepack prepare pnpm@10.15.1 --activate
else
  npm install --global pnpm@10.15.1
fi

[[ "$(node --version)" =~ ^v20\. ]] || fail "Node.js 20 não foi instalado corretamente: $(node --version)"
command -v pnpm >/dev/null 2>&1 || fail "pnpm não está disponível após a instalação."

info "Criando usuário de serviço e clonando o repositório..."
id "$APP_USER" >/dev/null 2>&1 || useradd --system --create-home --home-dir "$APP_DIR" --shell /usr/sbin/nologin "$APP_USER"
mkdir -p "$CONFIG_DIR" "/var/backups/${APP_NAME}"
chown "$APP_USER:$APP_USER" "/var/backups/${APP_NAME}"

CLONE_DIR="$(mktemp -d)"
cleanup_clone() { rm -rf "$CLONE_DIR"; }
trap cleanup_clone EXIT

info "Clonando como o usuário SSH ${CALLER}..."
sudo -H -u "$CALLER" git clone --depth=1 "$REPOSITORY_URL" "$CLONE_DIR/project"
mkdir -p "$APP_DIR"
cp -a "$CLONE_DIR/project/." "$APP_DIR/"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

info "Configurando MySQL local com privilégios separados..."
DB_PASSWORD="$(openssl rand -hex 24)"
MIGRATION_DB_PASSWORD="$(openssl rand -hex 24)"
JWT_SECRET="$(openssl rand -hex 48)"
SETUP_TOKEN="$(openssl rand -hex 32)"

systemctl enable --now mysql
mysql <<SQL
CREATE DATABASE IF NOT EXISTS autofin CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'autofin_app'@'localhost' IDENTIFIED BY '${DB_PASSWORD}';
ALTER USER 'autofin_app'@'localhost' IDENTIFIED BY '${DB_PASSWORD}';
CREATE USER IF NOT EXISTS 'autofin_migrate'@'localhost' IDENTIFIED BY '${MIGRATION_DB_PASSWORD}';
ALTER USER 'autofin_migrate'@'localhost' IDENTIFIED BY '${MIGRATION_DB_PASSWORD}';
GRANT SELECT, INSERT, UPDATE, DELETE ON autofin.* TO 'autofin_app'@'localhost';
GRANT ALL PRIVILEGES ON autofin.* TO 'autofin_migrate'@'localhost';
FLUSH PRIVILEGES;
SQL

umask 077
cat >"$CONFIG_FILE" <<EOF
NODE_ENV=production
PORT=3000
DATABASE_URL=mysql://autofin_app:${DB_PASSWORD}@127.0.0.1:3306/autofin
MIGRATION_DATABASE_URL=mysql://autofin_migrate:${MIGRATION_DB_PASSWORD}@127.0.0.1:3306/autofin
JWT_SECRET=${JWT_SECRET}
LOCAL_ADMIN_SETUP_TOKEN=${SETUP_TOKEN}
EOF
chown root:"$APP_USER" "$CONFIG_FILE"
chmod 640 "$CONFIG_FILE"

info "Instalando dependências, aplicando migrações e gerando o build..."
sudo -u "$APP_USER" env HOME="$APP_DIR" pnpm --dir "$APP_DIR" install --frozen-lockfile
sudo -u "$APP_USER" bash -c "set -a; source '$CONFIG_FILE'; set +a; cd '$APP_DIR'; DATABASE_URL=\"\$MIGRATION_DATABASE_URL\" pnpm exec drizzle-kit migrate"
sudo -u "$APP_USER" env HOME="$APP_DIR" pnpm --dir "$APP_DIR" build

info "Criando serviço systemd..."
cat >"$SERVICE_FILE" <<EOF
[Unit]
Description=AutoFin vehicle finance calculator
After=network.target mysql.service

[Service]
Type=simple
User=${APP_USER}
Group=${APP_USER}
WorkingDirectory=${APP_DIR}
EnvironmentFile=${CONFIG_FILE}
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=5
UMask=0077
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ProtectHome=true
ProtectClock=true
ProtectControlGroups=true
ProtectKernelModules=true
ProtectKernelTunables=true
RestrictSUIDSGID=true
LockPersonality=true

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now "$APP_NAME"
systemctl is-active --quiet "$APP_NAME" || {
  journalctl -u "$APP_NAME" -n 80 --no-pager
  fail "O serviço AutoFin não iniciou. Verifique os logs acima."
}

info "Configurando Nginx e firewall local..."
cat >"$NGINX_FILE" <<EOF
server {
    listen 80;
    server_name ${DOMAIN};
    client_max_body_size 2m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Connection "";
    }
}
EOF
ln -sfn "$NGINX_FILE" "/etc/nginx/sites-enabled/${APP_NAME}"
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

if [[ "$ENABLE_TLS" =~ ^[sS]$ ]]; then
  info "Solicitando certificado HTTPS. O DNS e o Security Group da AWS precisam liberar porta 80."
  certbot --nginx --non-interactive --redirect --agree-tos --no-eff-email --email "$CERT_EMAIL" -d "$DOMAIN"
  certbot renew --dry-run
else
  warn "HTTPS não foi emitido. Emita-o depois com: sudo certbot --nginx -d ${DOMAIN} --redirect"
fi

curl -fsSI http://127.0.0.1:3000 >/dev/null || fail "A aplicação não respondeu na porta interna 3000."

cat <<EOF

${GREEN}Instalação concluída.${RESET}

URL esperada: https://${DOMAIN}
Serviço: sudo systemctl status ${APP_NAME} --no-pager
Logs:    sudo journalctl -u ${APP_NAME} -f

Use o token abaixo uma única vez em "Acesso do dono" para criar o administrador:

${YELLOW}${SETUP_TOKEN}${RESET}

Guarde-o em um gerenciador de senhas. Depois do primeiro cadastro, revogue-o com:
sudo sed -i '/^LOCAL_ADMIN_SETUP_TOKEN=/d' ${CONFIG_FILE}
sudo systemctl restart ${APP_NAME}

Importante: confirme que o Security Group da EC2 libera 80/443 e que o DNS de ${DOMAIN}
aponta para o IP público ou Elastic IP da instância. O upload de logo exige configurar um
armazenamento S3 compatível externo antes de ser utilizado fora do ambiente gerenciado.
EOF
