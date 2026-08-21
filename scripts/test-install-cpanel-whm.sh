#!/usr/bin/env bash

set -Eeuo pipefail
IFS=$'\n\t'

readonly PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly TEMP_DIR="$(mktemp -d)"
readonly FAKE_BIN="$TEMP_DIR/bin"
readonly FAKE_HOME="$TEMP_DIR/home"

cleanup() {
  rm -rf "$TEMP_DIR"
}
trap cleanup EXIT

mkdir -p "$FAKE_BIN" "$FAKE_HOME/.local/bin"

cat >"$FAKE_BIN/uapi" <<'EOF'
#!/usr/bin/env bash
set -Eeuo pipefail
arguments="$*"
if [[ "$arguments" == *"list_databases"* ]]; then
  printf '%s\n' '{"result":{"data":[{"database":"demo_autofin"}]}}'
elif [[ "$arguments" == *"list_users"* ]]; then
  printf '%s\n' '{"result":{"data":[{"user":"demo_autoapp"}]}}'
fi
EOF

cat >"$FAKE_BIN/openssl" <<'EOF'
#!/usr/bin/env bash
set -Eeuo pipefail
case "${3:-}" in
  24) printf '%048d\n' 0 ;;
  32) printf '%064d\n' 0 ;;
  48) printf '%096d\n' 0 ;;
  *) exit 1 ;;
esac
EOF

cat >"$FAKE_BIN/corepack" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF

cat >"$FAKE_BIN/pnpm" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF

chmod 700 "$FAKE_BIN/uapi" "$FAKE_BIN/openssl" "$FAKE_BIN/corepack" "$FAKE_BIN/pnpm"

output="$({
  cd "$PROJECT_DIR"
  printf '\n\ns\n' | HOME="$FAKE_HOME" PATH="$FAKE_BIN:$PATH" bash scripts/install-cpanel-whm.sh
} 2>&1)"

env_file="$FAKE_HOME/.config/autofin/autofin.env"
[[ -f "$env_file" ]] || { printf 'Arquivo de ambiente não foi criado.\n' >&2; exit 1; }
[[ "$(stat -c '%a' "$env_file")" == "600" ]] || { printf 'Permissão do ambiente não é 600.\n' >&2; exit 1; }
grep -q '^DATABASE_URL=mysql://demo_autoapp:' "$env_file"
grep -q '@localhost/demo_autofin$' "$env_file"
grep -q '^JWT_SECRET=' "$env_file"
grep -q '^LOCAL_ADMIN_SETUP_TOKEN=' "$env_file"
[[ -f "$PROJECT_DIR/tmp/restart.txt" ]] || { printf 'restart.txt não foi criado.\n' >&2; exit 1; }
rm -f "$PROJECT_DIR/tmp/restart.txt"
grep -q 'Instalação local concluída' <<<"$output"

printf 'Teste do instalador cPanel/WHM aprovado.\n'
