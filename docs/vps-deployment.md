# Implantação em VPS

Esta aplicação é uma aplicação Node.js com React, Express, tRPC e MySQL/TiDB. Ela não requer processo em segundo plano; portanto, uma VPS pequena com Node.js 22 LTS, 1 vCPU e 1 GB de RAM é suficiente para um uso inicial moderado. A PWA exige **HTTPS** em produção: em iOS, a instalação pelo Safari depende de um contexto seguro.

## Preparação do servidor

No Ubuntu/Debian, instale Node.js 22 LTS, `pnpm`, Nginx e um cliente MySQL. Clone o repositório exportado e execute `pnpm install --frozen-lockfile` seguido de `pnpm build`. Configure um banco MySQL 8 ou compatível e aplique a migração `drizzle/0001_quick_darkstar.sql` antes de iniciar a aplicação.

| Variável | Finalidade | Recomendação de produção |
| --- | --- | --- |
| `NODE_ENV` | Modo de execução | `production` |
| `PORT` | Porta local exposta ao Nginx | Escolha uma porta interna livre. |
| `DATABASE_URL` | Conexão MySQL/TiDB | Usuário com privilégio apenas no banco da aplicação. |
| `JWT_SECRET` | Assinatura de sessão | Valor aleatório longo e exclusivo. |
| `VITE_APP_ID`, `OAUTH_SERVER_URL`, `VITE_OAUTH_PORTAL_URL` | Autenticação do template | Configure um provedor OAuth compatível ou substitua a camada de autenticação antes da exposição pública. |

> **Atenção sobre o painel de taxas:** a versão atual usa o controle administrativo por identidade de proprietário provido no template. Em uma VPS externa, configure um provedor OAuth próprio ou adapte esse controle a uma autenticação administrativa do seu ambiente antes de expor o painel de edição na internet. A calculadora pública e a base de taxas permanecem operacionais sem login.

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
EnvironmentFile=/etc/autofin/autofin.env
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
    }
}
```

Emita o certificado com Certbot e habilite o redirecionamento HTTP→HTTPS. Após a emissão, confirme no Safari que `https://autofin.seudominio.com` está acessível e use **Compartilhar → Adicionar à Tela de Início**. O arquivo `manifest.webmanifest`, o ícone Apple e o `sw.js` já fazem parte do build.

## Atualizações e operação

Em cada atualização, faça `git pull`, `pnpm install --frozen-lockfile`, `pnpm build` e `sudo systemctl restart autofin`. Antes de qualquer atualização de taxas, registre a nova taxa mensal, a fonte e as datas de vigência no painel administrativo. As médias iniciais foram carregadas a partir do Banco Central e devem ser tratadas como parâmetros de referência, nunca como aprovação ou proposta contratual.
