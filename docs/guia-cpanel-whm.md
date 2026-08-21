# Guia rápido: AutoFin em VPS com cPanel/WHM

Este guia instala a **AutoFin** em uma conta cPanel hospedada em VPS administrada pelo WHM. Use o **Application Manager** com Phusion Passenger; ele já atua como gerenciador de processos e proxy da aplicação, portanto **não use PM2** neste cenário. [1]

> **WHMCS não é necessário para executar a AutoFin.** Se ele for usado para vender ou provisionar a hospedagem, crie uma conta cPanel normal pelo WHM/WHMCS e siga este guia dentro dessa conta. Mantenha o banco da AutoFin separado do banco do WHMCS.

## 1. Pré-requisitos no WHM

| Local | Ação necessária |
| --- | --- |
| WHM → EasyApache 4 | Instalar `ea-apache24-mod-passenger`, `ea-apache24-mod_env` e `ea-nodejs22`. |
| WHM → Feature Manager | Habilitar **Application Manager** e **Terminal** para o pacote da conta cPanel. |
| WHM → Create a New Account | Criar a conta cPanel do domínio da AutoFin. |
| DNS | Apontar o registro `A` de `autofin.seudominio.com` ao IP da VPS. |

O cPanel exige Passenger e `mod_env` para registrar aplicações com variáveis de ambiente; Node.js 22 é uma das versões disponibilizadas por EasyApache. [1] [2]

> A documentação padrão de Node.js do cPanel é direcionada a AlmaLinux/Rocky Linux. Em uma VPS cPanel sobre Ubuntu, use a documentação de Passenger para Ubuntu ou solicite ao provedor uma imagem compatível com cPanel. [2]

## 2. Crie o banco no cPanel

No cPanel, abra **Databases → MySQL Database Wizard**. Crie um banco com sufixo `autofin` e um usuário com sufixo `autoapp`. O cPanel normalmente acrescenta o prefixo da conta automaticamente. Por exemplo, os nomes finais podem aparecer como:

| Recurso | Exemplo final |
| --- | --- |
| Banco | `conta_autofin` |
| Usuário | `conta_autoapp` |

Crie uma senha sem caracteres especiais para evitar precisar codificá-la na URL. No Terminal do cPanel, gere uma com:

```bash
openssl rand -hex 24
```

Cole essa senha no assistente e selecione **ALL PRIVILEGES**. Como este guia usa uma única `DATABASE_URL`, o mesmo usuário precisa criar e alterar tabelas durante as migrações. O MySQL Database Wizard e a associação do usuário ao banco são os métodos recomendados pela documentação do cPanel. [3]

## 3. Copie o projeto e instale dependências

Abra **cPanel → Advanced → Terminal** ou conecte-se via SSH como o usuário da conta cPanel. Não use `root` para os comandos da aplicação. [2]

```bash
cd ~
git clone <URL_PRIVADA_DO_REPOSITORIO> autofin
cd ~/autofin

export PATH="/opt/cpanel/ea-nodejs22/bin:$HOME/.local/bin:$PATH"
corepack enable --install-directory "$HOME/.local/bin"
corepack prepare pnpm@10.15.1 --activate
pnpm install --frozen-lockfile
```

Se o repositório já foi enviado pelo **File Manager** ou SFTP, use o diretório existente em vez de clonar. O projeto inclui `app.js`, que importa `dist/index.js`; esse nome é importante porque o Passenger procura `app.js` por padrão. [2]

## 4. Execute a migração inicial e gere o build

Crie um arquivo temporário privado para a migração. Troque todos os valores entre `<...>` pelos **nomes completos** exibidos no cPanel, incluindo o prefixo da conta.

```bash
umask 077
cat > ~/.autofin-migrate.env <<'EOF'
DATABASE_URL=mysql://<USUARIO_COMPLETO>:<SENHA_HEX>@localhost/<BANCO_COMPLETO>
EOF

set -a
. ~/.autofin-migrate.env
set +a

cd ~/autofin
pnpm exec drizzle-kit migrate
pnpm build
rm -f ~/.autofin-migrate.env
```

> Não envie a senha, a URL completa ou o conteúdo do arquivo privado por chat. Caso a migração seja concluída, as tabelas foram criadas corretamente.

## 5. Registre a aplicação no Application Manager

No cPanel, abra **Software → Application Manager → Register Application** e preencha:

| Campo | Valor |
| --- | --- |
| Application Name | `autofin` |
| Deployment Domain | Seu domínio ou subdomínio, por exemplo `autofin.seudominio.com` |
| Base Application URL | `/` |
| Application Path | `autofin` |
| Deployment Environment | `Production` |

Na seção **Environment Variables**, inclua estas quatro variáveis:

| Nome | Valor |
| --- | --- |
| `NODE_ENV` | `production` |
| `DATABASE_URL` | `mysql://<USUARIO_COMPLETO>:<SENHA_HEX>@localhost/<BANCO_COMPLETO>` |
| `JWT_SECRET` | Saída de `openssl rand -hex 48` |
| `LOCAL_ADMIN_SETUP_TOKEN` | Saída de `openssl rand -hex 32` |

Clique em **Deploy**. O Application Manager permite definir variáveis de ambiente por aplicação, mantendo os segredos fora do repositório. [1]

## 6. Reinicie e valide localmente

Depois do Deploy, no Terminal execute:

```bash
cd ~/autofin
mkdir -p tmp
touch tmp/restart.txt
```

O arquivo `tmp/restart.txt` instrui o Passenger a reiniciar a aplicação após mudanças. [2] Em seguida, abra o domínio no navegador. Os logs da aplicação ficam em `~/autofin/logs/` conforme o Application Manager. [1]

## 7. Ative HTTPS e instale a PWA

Quando o DNS já apontar para a VPS, abra **cPanel → Security → SSL/TLS Status** e execute **Run AutoSSL** para o domínio. Só entregue a AutoFin com HTTPS: o Safari exige contexto seguro para instalar a PWA.

No iPhone, abra a URL HTTPS no Safari, toque em **Compartilhar** e use **Adicionar à Tela de Início**.

## 8. Crie o administrador e revogue o token

Abra a AutoFin, escolha **Acesso do dono** e cadastre a primeira conta com um nome de usuário, senha longa e o `LOCAL_ADMIN_SETUP_TOKEN` configurado no Application Manager.

Logo após criar o administrador, volte ao **Application Manager**, edite a aplicação e remova `LOCAL_ADMIN_SETUP_TOKEN`. Clique em **Deploy** e, no Terminal, execute novamente:

```bash
cd ~/autofin
touch tmp/restart.txt
```

## Atualizações futuras

Para atualizar, execute como o usuário cPanel:

```bash
cd ~/autofin
git pull
pnpm install --frozen-lockfile

umask 077
cat > ~/.autofin-migrate.env <<'EOF'
DATABASE_URL=mysql://<USUARIO_COMPLETO>:<SENHA_HEX>@localhost/<BANCO_COMPLETO>
EOF
set -a && . ~/.autofin-migrate.env && set +a
pnpm exec drizzle-kit migrate
pnpm build
rm -f ~/.autofin-migrate.env
mkdir -p tmp && touch tmp/restart.txt
```

## Observações importantes

O cálculo, o painel local, o PDF e a sincronização de taxas podem operar nessa instalação. Já o upload de logo editável depende de armazenamento S3 compatível, pois a implementação atual usa o armazenamento do ambiente gerenciado durante o desenvolvimento. Antes de usar essa função na VPS, adapte `server/storage.ts` para um provedor S3 externo.

## Referências

[1] [cPanel — Application Manager](https://docs.cpanel.net/cpanel/software/application-manager/)

[2] [cPanel — How to Install a Node.js Application](https://docs.cpanel.net/knowledge-base/web-services/how-to-install-a-node.js-application/)

[3] [cPanel — MySQL Databases](https://docs.cpanel.net/cpanel/databases/mysql-databases/)
