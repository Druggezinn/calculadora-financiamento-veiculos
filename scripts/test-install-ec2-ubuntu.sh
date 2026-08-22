#!/usr/bin/env bash

set -Eeuo pipefail

readonly PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly INSTALLER="$PROJECT_DIR/scripts/install-ec2-ubuntu.sh"

bash -n "$INSTALLER"
help_output="$(bash "$INSTALLER" --help)"

grep -q 'EC2 Ubuntu' <<<"$help_output"
grep -q 'Node.js 20' <<<"$help_output"
grep -q 'Security Group' <<<"$help_output"
grep -q 'NODE_MAJOR="20"' "$INSTALLER"
grep -q 'pnpm@10.15.1' "$INSTALLER"
grep -q 'corepack disable pnpm' "$INSTALLER"
grep -q 'npm install --global pnpm@10.15.1' "$INSTALLER"
grep -Fq 'PNPM_CLI="$(npm root --global)/pnpm/bin/pnpm.cjs"' "$INSTALLER"
grep -Fq "node '\$PNPM_CLI' install --frozen-lockfile" "$INSTALLER"
grep -Fq "node '\$PNPM_CLI' exec drizzle-kit migrate" "$INSTALLER"
grep -Fq "node '\$PNPM_CLI' build" "$INSTALLER"
grep -q 'mysql-server' "$INSTALLER"
grep -q 'certbot' "$INSTALLER"
grep -q 'systemd' "$INSTALLER"
grep -q 'git clone' "$INSTALLER"
grep -q 'chown "$CALLER:$(id -gn "$CALLER")" "$CLONE_DIR"' "$INSTALLER"
grep -q "! -name '.bashrc'" "$INSTALLER"
grep -q 'useradd --system --home-dir "$APP_DIR"' "$INSTALLER"
grep -q 'install -d -o "$APP_USER" -g "$APP_USER" -m 750 "$APP_DIR"' "$INSTALLER"
grep -q 'LOCAL_ADMIN_SETUP_TOKEN' "$INSTALLER"

printf 'Teste estático do instalador EC2/Ubuntu aprovado.\n'
