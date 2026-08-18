# Implantação em VPS

Esta aplicação é uma aplicação Node.js com React, Express, tRPC e MySQL/TiDB. Ela não requer processo em segundo plano; portanto, uma VPS pequena com Node.js 22 LTS, 1 vCPU e 1 GB de RAM é suficiente para um uso inicial moderado. A PWA exige **HTTPS** em produção: em iOS, a instalação pelo Safari depende de um contexto seguro.

## Preparação do servidor

No Ubuntu/Debian, instale Node.js 22 LTS, `pnpm`, Nginx e um cliente MySQL. Clone o repositório exportado e execute `pnpm install --frozen-lockfile` seguido de `pnpm build`. Configure um banco MySQL 8 ou compatível e aplique **todas** as migrações em `drizzle/` antes de iniciar a aplicação.

| Variável | Finalidade | Recomendação de produção |
| --- | --- | --- |
| `NODE_ENV` | Modo de execução | `production` |
| `PORT` | Porta local exposta ao Nginx | Escolha uma porta interna livre. |
| `DATABASE_URL` | Conexão MySQL/TiDB | Usuário com privilégio apenas no banco da aplicação. |
| `JWT_SECRET` | Assinatura de sessão | Valor aleatório longo e exclusivo. |
| `LOCAL_ADMIN_SETUP_TOKEN` | Libera a criação única do primeiro administrador | Token aleatório com pelo menos 32 caracteres; mantenha apenas em arquivo com permissão `600`. |

> **Atenção sobre o painel de taxas:** o acesso administrativo usa um usuário local com senha em hash **Argon2id**, sessão opaca armazenada em cookie `HttpOnly`/`Secure`, expiração de oito horas e bloqueio temporário após tentativas falhas. A senha e seu hash não devem aparecer em arquivos de configuração, logs ou no repositório.

## Provisionamento do administrador local

Use `docs/vps-config.template` como referência e crie um arquivo privado, por exemplo `/etc/autofin/autofin.config`. Defina `LOCAL_ADMIN_SETUP_TOKEN` com uma sequência longa e aleatória, execute `sudo chown autofin:autofin /etc/autofin/autofin.config` e `sudo chmod 600 /etc/autofin/autofin.config`.

Depois que o domínio HTTPS estiver ativo, abra a aplicação e selecione **Acesso do dono**. No primeiro uso, informe um identificador, uma senha de pelo menos 12 caracteres e o token privado. A aplicação cria o administrador com hash Argon2id; em seguida, remova `LOCAL_ADMIN_SETUP_TOKEN` do arquivo de configuração e reinicie o serviço. Dessa forma, o provisionamento inicial não pode ser repetido.

## Processo da aplicação

Crie um arquivo `/etc/systemd/system/autofin.service`, ajustando usuário, diretório, porta e variáveis de ambiente para o seu servidor.

```ini
[Unit]
Description=AutoFin vehicle finance calculator
After=network.target

[Service]
Type=simple
User=autofin
WorkingDirectory=/srv/autofin
Environment=NODE_ENV=production
Environment=PORT=3000
EnvironmentFile=/etc/autofin/autofin.config
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Ative com `sudo systemctl daemon-reload`, `sudo systemctl enable --now autofin` e valide com `sudo systemctl status autofin`. A aplicação deve permanecer restrita à rede local; deixe a exposição pública sob responsabilidade do Nginx.

## Nginx e HTTPS

Configure o Nginx como proxy reverso, substituindo `autofin.seudominio.com` pelo domínio real e a porta pela configurada no serviço.

```nginx
server {
    listen 80;
    server_name autofin.seudominio.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        add_header X-Content-Type-Options "nosniff" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;
        add_header X-Frame-Options "DENY" always;
        add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
    }
}
```

Emita o certificado com Certbot e habilite o redirecionamento HTTP→HTTPS. Após a emissão, confirme no Safari que `https://autofin.seudominio.com` está acessível e use **Compartilhar → Adicionar à Tela de Início**. O arquivo `manifest.webmanifest`, o ícone Apple e o `sw.js` já fazem parte do build.

## Atualizações e operação

Em cada atualização, faça `git pull`, `pnpm install --frozen-lockfile`, aplique migrações pendentes, execute `pnpm build` e `sudo systemctl restart autofin`. O botão **Atualizar taxas** consulta manualmente o serviço público do Banco Central, faz correspondência pelo CNPJ-base de cada financeira e registra a ação no histórico administrativo. Revise o resultado e a data de referência antes de usar uma simulação comercial. As médias devem ser tratadas como parâmetros de referência, nunca como aprovação ou proposta contratual.

## Checklist de segurança operacional

Mantenha o MySQL acessível somente pela rede privada ou por `127.0.0.1`, com um usuário específico da aplicação e privilégio apenas no banco AutoFin. Restrinja o firewall a SSH e HTTP/HTTPS, atualize o sistema operacional e dependências regularmente, proteja o SSH com chaves e copie backups cifrados para fora da VPS. Verifique periodicamente os registros do Nginx, do systemd e a tabela de auditoria administrativa.
