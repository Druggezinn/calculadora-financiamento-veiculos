# Guia passo a passo: instalar a AutoFin em uma VPS Ubuntu

Este roteiro instala a **AutoFin** em uma VPS Ubuntu 24.04 LTS ou semelhante, com MySQL local, Nginx, HTTPS, serviço `systemd` e o painel administrativo local. Use um subdomínio próprio, por exemplo `autofin.seudominio.com`.

> **Importante:** execute os comandos com um usuário que tenha `sudo`. Substitua todos os valores entre `<...>` pelos dados do seu ambiente. Não publique nem envie o arquivo de configuração da aplicação, senhas, token de provisionamento ou backups do banco.

## Visão geral e pré-requisitos

| Item | Recomendação inicial | Observação |
| --- | --- | --- |
| Sistema operacional | Ubuntu 24.04 LTS | O guia também se aplica a versões Ubuntu/Debian compatíveis. |
| VPS | 1 vCPU, 1 GB RAM, 20 GB SSD | Adequado para operação inicial de baixo a moderado volume. |
| Domínio | Subdomínio com registro `A` | Deve apontar para o IP público da VPS antes do HTTPS. |
| Portas públicas | `22`, `80`, `443` | O Node.js ficará acessível apenas internamente em `127.0.0.1:3000`. |
| Componentes | Node.js 22, pnpm, MySQL, Nginx e Certbot | O Certbot com Nginx exige que o domínio esteja acessível por HTTP na porta 80 para a validação usual. [2] |

## 1. Acesse e atualize o servidor

No seu computador, conecte-se por SSH. Troque o endereço pelo IP ou nome da sua VPS.

```bash
ssh <usuario>@<ip-da-vps>
sudo apt update && sudo apt upgrade -y
sudo apt install -y ca-certificates curl git build-essential ufw nginx mysql-server snapd
```

Crie um usuário de sistema sem login interativo para executar apenas a AutoFin. Isso evita que o processo web rode como `root`.

```bash
sudo useradd --system --create-home --home-dir /srv/autofin --shell /usr/sbin/nologin autofin
sudo mkdir -p /etc/autofin /var/backups/autofin
sudo chown autofin:autofin /var/backups/autofin
```

Ative um firewall mínimo. **Mantenha a sessão SSH aberta** até confirmar que consegue abrir uma segunda sessão, pois uma regra incorreta pode bloquear seu acesso.

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status verbose
```

## 2. Instale Node.js 22 e pnpm

Instale o repositório NodeSource para a linha 22 e, depois, ative o Corepack, que administra a versão declarada de `pnpm` no projeto. Consulte a distribuição NodeSource caso sua versão de Ubuntu exija uma alternativa. [1]

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo corepack enable
sudo corepack prepare pnpm@10.15.1 --activate
node --version
pnpm --version
```

Os dois últimos comandos devem confirmar Node.js na série `22` e `pnpm` disponível.

## 3. Instale e restrinja o MySQL

O Ubuntu fornece `mysql-server` com administração local por `sudo mysql`; é recomendado criar uma conta própria e limitada para a aplicação em vez de usar `root`. [3]

Gere senhas hexadecimais sem caracteres que precisem ser escapados em uma URL. A conta de execução terá somente os privilégios de aplicação; a conta de migração será usada apenas nos comandos de atualização. Guarde ambos os valores em um gerenciador de senhas até copiá-los para a configuração privada no passo 5.

```bash
DB_PASSWORD=$(openssl rand -hex 24)
MIGRATION_DB_PASSWORD=$(openssl rand -hex 24)
echo "Senha de execução: ${DB_PASSWORD}"
echo "Senha de migração: ${MIGRATION_DB_PASSWORD}"
```

Crie o banco e as contas locais. A AutoFin em execução precisa apenas de leitura e escrita; somente a conta de migração recebe privilégios de DDL dentro do banco `autofin`.

```bash
sudo mysql <<SQL
CREATE DATABASE autofin CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'autofin_app'@'localhost' IDENTIFIED BY '${DB_PASSWORD}';
CREATE USER 'autofin_migrate'@'localhost' IDENTIFIED BY '${MIGRATION_DB_PASSWORD}';
GRANT SELECT, INSERT, UPDATE, DELETE ON autofin.* TO 'autofin_app'@'localhost';
GRANT ALL PRIVILEGES ON autofin.* TO 'autofin_migrate'@'localhost';
FLUSH PRIVILEGES;
SQL
```

Verifique se o MySQL escuta apenas localmente; a saída deve mostrar `127.0.0.1:3306` ou uma interface privada, nunca a internet pública sem necessidade.

```bash
sudo systemctl enable --now mysql
sudo ss -ltnp | grep 3306
```

> O MySQL documenta a criação de usuários locais e o uso de privilégios específicos; mantenha o acesso remoto desativado quando banco e aplicação estiverem na mesma VPS. [3]

## 4. Copie o projeto para a VPS e instale dependências

Envie o ZIP/código exportado pela interface do projeto para a VPS ou clone o repositório Git que contém a AutoFin. O exemplo abaixo usa Git.

```bash
sudo -u autofin git clone <URL_DO_REPOSITORIO> /srv/autofin
cd /srv/autofin
sudo -u autofin pnpm install --frozen-lockfile
```

Se o projeto já estiver em `/srv/autofin`, substitua o clone por um `git pull` executado pelo usuário `autofin`.

## 5. Crie o arquivo privado de configuração

Gere os segredos de sessão e do primeiro administrador. Esses valores são diferentes: `JWT_SECRET` protege a infraestrutura de sessão; `LOCAL_ADMIN_SETUP_TOKEN` permite **uma única criação** do administrador local.

```bash
JWT_SECRET=$(openssl rand -hex 48)
SETUP_TOKEN=$(openssl rand -hex 32)
sudo tee /etc/autofin/autofin.config > /dev/null <<EOF
NODE_ENV=production
PORT=3000
DATABASE_URL=mysql://autofin_app:${DB_PASSWORD}@127.0.0.1:3306/autofin
MIGRATION_DATABASE_URL=mysql://autofin_migrate:${MIGRATION_DB_PASSWORD}@127.0.0.1:3306/autofin
JWT_SECRET=${JWT_SECRET}
LOCAL_ADMIN_SETUP_TOKEN=${SETUP_TOKEN}
EOF
sudo chown autofin:autofin /etc/autofin/autofin.config
sudo chmod 600 /etc/autofin/autofin.config
sudo stat -c '%A %U:%G %n' /etc/autofin/autofin.config
```

Após conferir o arquivo, **apague o histórico do terminal** ou feche a sessão, pois os comandos acima contêm segredos. O modelo sem segredos está em `docs/vps-config.template`; ele é a referência para futuras configurações, não o arquivo operacional.

## 6. Aplique as migrações e gere o build de produção

Carregue as variáveis só para a execução do comando de migração. Em seguida, faça o build com o usuário de serviço.

```bash
cd /srv/autofin
sudo -u autofin bash -c 'set -a; source /etc/autofin/autofin.config; set +a; DATABASE_URL="$MIGRATION_DATABASE_URL" pnpm exec drizzle-kit migrate'
sudo -u autofin pnpm build
```

Caso o projeto exportado use outro comando de migração, mantenha a regra: aplique todas as migrações pendentes em `drizzle/` **antes** de reiniciar a aplicação.

## 7. Crie o serviço systemd

Crie o arquivo abaixo. O processo Node escuta apenas em uma porta interna; o Nginx fará a exposição pública.

```bash
sudo tee /etc/systemd/system/autofin.service > /dev/null <<'EOF'
[Unit]
Description=AutoFin vehicle finance calculator
After=network.target mysql.service

[Service]
Type=simple
User=autofin
Group=autofin
WorkingDirectory=/srv/autofin
EnvironmentFile=/etc/autofin/autofin.config
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

sudo systemctl daemon-reload
sudo systemctl enable --now autofin
sudo systemctl status autofin --no-pager
curl -I http://127.0.0.1:3000
```

Se houver erro, acompanhe os logs sem expor seu arquivo de configuração:

```bash
sudo journalctl -u autofin -n 100 --no-pager
```

## 8. Aponte o domínio e configure o Nginx

No painel do seu provedor de DNS, crie um registro `A` para `autofin.seudominio.com` apontando para o IP público da VPS. Aguarde a propagação e confirme antes de emitir o certificado.

```bash
dig +short autofin.seudominio.com
```

Crie a configuração Nginx abaixo e troque `autofin.seudominio.com` pelo domínio real.

```bash
sudo tee /etc/nginx/sites-available/autofin > /dev/null <<'NGINX'
server {
    listen 80;
    server_name autofin.seudominio.com;

    client_max_body_size 2m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";
    }
}
NGINX

sudo ln -s /etc/nginx/sites-available/autofin /etc/nginx/sites-enabled/autofin
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
curl -I http://autofin.seudominio.com
```

## 9. Emita o certificado HTTPS

A PWA precisa de HTTPS para instalação no Safari do iOS. O Certbot orienta instalar seu pacote, executar `certbot --nginx` e validar posteriormente a renovação automática. [2]

```bash
sudo snap install --classic certbot
sudo ln -sf /snap/bin/certbot /usr/local/bin/certbot
sudo certbot --nginx -d autofin.seudominio.com --redirect --email <seu-email> --agree-tos --no-eff-email
sudo certbot renew --dry-run
```

Depois de confirmar o HTTPS, acrescente ao bloco HTTPS que o Certbot criou:

```nginx
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header X-Frame-Options "DENY" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;
add_header Content-Security-Policy "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'" always;
```

Valide e recarregue o Nginx após a alteração.

```bash
sudo nginx -t && sudo systemctl reload nginx
```

## 10. Crie o primeiro administrador e invalide o token

Abra `https://autofin.seudominio.com` no navegador. Selecione **Acesso do dono**, informe um nome de usuário, uma senha longa e exclusiva (mínimo de 12 caracteres) e o valor de `LOCAL_ADMIN_SETUP_TOKEN` salvo no arquivo privado.

Após a confirmação, remova a linha `LOCAL_ADMIN_SETUP_TOKEN` para impedir qualquer novo provisionamento e reinicie a aplicação.

```bash
sudo sed -i '/^LOCAL_ADMIN_SETUP_TOKEN=/d' /etc/autofin/autofin.config
sudo systemctl restart autofin
```

Faça um teste de login com a nova conta e, então, entre no painel para editar a marca, enviar o logo e revisar as taxas. O botão **Atualizar taxas** consulta a fonte oficial manualmente e grava uma trilha de auditoria; revise a data e a correspondência antes de apresentar uma proposta ao cliente.

## 11. Instale no iPhone e faça a verificação final

No Safari do iPhone, abra a URL HTTPS, toque em **Compartilhar** e escolha **Adicionar à Tela de Início**. Valide a tela de login, uma simulação, a exportação de PDF, a atualização manual de taxas e o carregamento offline básico.

| Verificação | Comando ou ação esperada |
| --- | --- |
| Serviço | `sudo systemctl is-active autofin` retorna `active`. |
| Proxy | `curl -I https://autofin.seudominio.com` retorna resposta HTTPS. |
| Certificado | `sudo certbot renew --dry-run` conclui sem erro. [2] |
| Banco | `sudo mysql -e "SHOW DATABASES LIKE 'autofin';"` lista o banco. |
| Proteção | `/etc/autofin/autofin.config` pertence a `autofin` e tem permissão `600`. |
| Administrador | O token de provisionamento não existe mais no arquivo após a criação da conta. |

## 12. Atualizações, backup e recuperação

Antes de atualizar, faça backup. O `mysqldump` é uma ferramenta incluída no MySQL para backups lógicos; mantenha cópias cifradas fora da VPS. [3]

Crie uma configuração de cliente MySQL exclusivamente para o backup, com as mesmas credenciais da aplicação. Ajuste `<senha-do-banco>` com o valor original de `DB_PASSWORD` e mantenha o arquivo com permissão restrita.

```bash
sudo tee /etc/autofin/mysql-backup.cnf > /dev/null <<'EOF'
[client]
host=127.0.0.1
user=autofin_app
password=<senha-do-banco>
EOF
sudo chown autofin:autofin /etc/autofin/mysql-backup.cnf
sudo chmod 600 /etc/autofin/mysql-backup.cnf
sudo -u autofin bash -c 'mysqldump --defaults-extra-file=/etc/autofin/mysql-backup.cnf --single-transaction autofin | gzip > /var/backups/autofin/autofin-$(date +%F).sql.gz'
```

Para atualizar o código:

```bash
cd /srv/autofin
sudo -u autofin git pull
sudo -u autofin pnpm install --frozen-lockfile
sudo -u autofin bash -c 'set -a; source /etc/autofin/autofin.config; set +a; DATABASE_URL="$MIGRATION_DATABASE_URL" pnpm exec drizzle-kit migrate'
sudo -u autofin pnpm build
sudo systemctl restart autofin
sudo systemctl status autofin --no-pager
```

> **Observação sobre backup:** o arquivo `/etc/autofin/mysql-backup.cnf` contém um segredo operacional. Não o inclua em repositórios, e faça cópias cifradas dos arquivos `.sql.gz` em outro local. Para restaurar, descompacte o arquivo e use `mysql --defaults-extra-file=/etc/autofin/mysql-backup.cnf autofin < arquivo.sql`.

## Referências

[1] [NodeSource — distribuições Node.js](https://github.com/nodesource/distributions)

[2] [Certbot — instruções para Nginx em Linux](https://certbot.eff.org/instructions?ws=nginx&os=ubuntufocal)

[3] [Ubuntu Server — instalação e configuração do MySQL](https://ubuntu.com/server/docs/how-to/databases/install-mysql/)
