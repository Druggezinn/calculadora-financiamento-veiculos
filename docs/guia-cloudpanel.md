# Guia de implantação: AutoFin em VPS com CloudPanel

Este roteiro instala a **AutoFin** em uma VPS Ubuntu já gerenciada pelo **CloudPanel v2**. Ele usa o tipo de site **Node.js** do próprio CloudPanel, o proxy Nginx criado pelo painel, MySQL local, PM2 sob o usuário do site e o painel administrativo local da AutoFin.

> **Não crie um Reverse Proxy manual nem altere o vhost Nginx do CloudPanel.** Para esta aplicação, escolha **Node.js Site** e informe a porta interna `3000`. O CloudPanel gerencia o proxy e redireciona HTTP para HTTPS quando o site é criado. [1]

## 1. Pré-requisitos e decisões

| Item | Valor recomendado | Motivo |
| --- | --- | --- |
| Sistema | Ubuntu 24.04 LTS com CloudPanel v2 | Base compatível com Node.js, PM2 e MySQL local. |
| Domínio | `autofin.seudominio.com` | Deve possuir registro `A` apontando para o IP da VPS antes do certificado. |
| Node.js | Série 22 | Compatível com o projeto e selecionável ao criar um Node.js Site. |
| Porta da app | `3000` | É a porta interna usada pelo processo Node e pelo proxy do CloudPanel. |
| Usuário do site | Ex.: `autofin` | O CloudPanel cria um usuário SSH próprio e mantém os arquivos sob `/home/<usuario>`. [1] |
| Banco | MySQL local do CloudPanel | Evita expor a porta 3306 à internet. |

Antes de começar, atualize o CloudPanel e a VPS. Proteja as portas **22** e **8443** por lista de IPs permitidos; o próprio CloudPanel recomenda essa restrição e também autenticação básica diante do painel quando não for possível fixar um IP. [5] Use senhas exclusivas e habilite 2FA na conta do CloudPanel.

## 2. DNS e site Node.js no CloudPanel

No provedor DNS, crie um registro `A` para `autofin.seudominio.com` apontando para o IP público da VPS. Depois, no CloudPanel, acesse **Sites → Add Site → Node.js Site** e preencha:

| Campo do CloudPanel | Valor |
| --- | --- |
| Domain Name | `autofin.seudominio.com` |
| Node.js Version | `22` |
| App Port | `3000` |
| Site User | `autofin` ou outro nome exclusivo |

Guarde a senha inicial do **Site User** em um gerenciador de senhas. O painel usa esse usuário para SSH e mantém os arquivos na pasta pessoal dele. [1] Após criar o site, conecte-se por SSH com esse usuário:

```bash
ssh autofin@<IP_DA_VPS>
cd ~/htdocs/autofin.seudominio.com
node --version
```

> O caminho `~/htdocs/<domínio>` e o uso do Site User seguem a documentação de implantação Node.js do CloudPanel. [2]

## 3. Banco de dados e princípio do menor privilégio

No CloudPanel, entre em **Databases → Add Database** e crie:

| Recurso | Nome sugerido | Permissões |
| --- | --- | --- |
| Banco | `autofin` | — |
| Usuário de migração | `autofin_migrate` | Todas as permissões sobre `autofin`; usado apenas em migrações. |
| Usuário da aplicação | `autofin_app` | Somente `SELECT`, `INSERT`, `UPDATE` e `DELETE` sobre `autofin`. |

Crie o banco inicialmente com o usuário de migração e, em seguida, use **Add Database User** para associar `autofin_app` somente às permissões de leitura e escrita indicadas. A interface do CloudPanel permite criar usuários adicionais e selecionar permissões por banco. [3] Gere senhas sem caracteres especiais para facilitar a URL de conexão:

```bash
openssl rand -hex 24
```

Não abra a porta `3306` no firewall. O acesso do Node ao banco deve usar `127.0.0.1`.

## 4. Obtenha o código e instale dependências

No diretório criado pelo CloudPanel, clone o repositório privado da AutoFin. Se você recebeu o projeto como arquivo ZIP, envie-o por SFTP usando o **Site User**, extraia-o nesse mesmo diretório e confirme que `package.json` está na raiz.

```bash
cd ~/htdocs/autofin.seudominio.com
git clone <URL_PRIVADA_DO_REPOSITORIO> .
corepack enable
corepack prepare pnpm@10.15.1 --activate
pnpm install --frozen-lockfile
```

Nunca registre um arquivo `.env` com senhas no Git. As configurações privadas ficarão fora da pasta do projeto.

## 5. Crie o arquivo privado de ambiente

Gere o segredo de sessão e o token de provisionamento. Eles têm finalidades diferentes: `JWT_SECRET` protege a infraestrutura de sessão e `LOCAL_ADMIN_SETUP_TOKEN` só permite o primeiro cadastro administrativo.

```bash
mkdir -p ~/.config
JWT_SECRET=$(openssl rand -hex 48)
SETUP_TOKEN=$(openssl rand -hex 32)
cat > ~/.config/autofin.env <<EOF
NODE_ENV=production
PORT=3000
DATABASE_URL=mysql://autofin_app:<SENHA_APP>@127.0.0.1:3306/autofin
MIGRATION_DATABASE_URL=mysql://autofin_migrate:<SENHA_MIGRATE>@127.0.0.1:3306/autofin
JWT_SECRET=${JWT_SECRET}
LOCAL_ADMIN_SETUP_TOKEN=${SETUP_TOKEN}
EOF
chmod 600 ~/.config/autofin.env
```

Substitua os marcadores de senha diretamente no arquivo e **não execute `cat ~/.config/autofin.env` em telas compartilhadas**. Confira somente permissões e proprietário:

```bash
stat -c '%A %U:%G %n' ~/.config/autofin.env
```

## 6. Migrações, build e inicialização com PM2

Carregue as variáveis no processo atual, aplique migrações com a conta privilegiada e gere o build:

```bash
cd ~/htdocs/autofin.seudominio.com
set -a
. ~/.config/autofin.env
set +a
DATABASE_URL="$MIGRATION_DATABASE_URL" pnpm exec drizzle-kit migrate
pnpm build
```

Instale o PM2 sob o Site User. O CloudPanel recomenda PM2 para manter aplicações Node.js em execução e recuperá-las após falhas. [2]

```bash
npm install pm2@latest -g
mkdir -p ~/bin
cat > ~/bin/autofin-start <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
set -a
. "$HOME/.config/autofin.env"
set +a
cd "$HOME/htdocs/autofin.seudominio.com"
exec pnpm start
EOF
chmod 700 ~/bin/autofin-start
pm2 start ~/bin/autofin-start --name autofin --interpreter bash
pm2 save
pm2 status
curl -I http://127.0.0.1:3000
```

Para o processo voltar automaticamente após reiniciar a VPS, siga o método do CloudPanel: copie a saída de `echo $PATH`, abra `crontab -e` como o Site User e insira as duas linhas abaixo. [2]

```cron
PATH=<COLE_A_SAIDA_DE_echo_$PATH_AQUI>
@reboot pm2 resurrect &> /dev/null
```

## 7. Certificado HTTPS e PWA

No CloudPanel, abra o site em **Sites → autofin.seudominio.com → TLS**, escolha **Actions → New Let's Encrypt Certificate**, informe o domínio e conclua **Create and Install**. O DNS deve estar propagado antes da emissão. [4]

Valide o resultado:

```bash
curl -I https://autofin.seudominio.com
pm2 status
pm2 logs autofin --lines 100
```

O Safari só permite instalar a PWA em contexto HTTPS. Depois do certificado, abra a URL no iPhone, use **Compartilhar → Adicionar à Tela de Início** e valide uma simulação, o login, o PDF e o modo offline básico.

## 8. Primeiro administrador e armazenamento de logo

Abra `https://autofin.seudominio.com`, selecione **Acesso do dono** e use o valor de `LOCAL_ADMIN_SETUP_TOKEN` uma única vez para criar o administrador. Em seguida, apague o token do arquivo privado e reinicie o processo:

```bash
sed -i '/^LOCAL_ADMIN_SETUP_TOKEN=/d' ~/.config/autofin.env
pm2 restart autofin
```

> **Atenção ao logo editável:** a implementação atual de armazenamento usa a infraestrutura de objetos do ambiente gerenciado em que o projeto foi desenvolvido. Uma VPS com CloudPanel não recebe essas credenciais automaticamente. Para que o upload de logo funcione na VPS, configure antes um armazenamento S3 compatível externo ou adapte o módulo `server/storage.ts` para o seu provedor. O cálculo, o painel local, a sincronização do Banco Central e os PDFs não dependem desse armazenamento.

## 9. Atualizações, backups e recuperação

Para uma atualização normal, execute como o Site User:

```bash
cd ~/htdocs/autofin.seudominio.com
git pull
pnpm install --frozen-lockfile
set -a
. ~/.config/autofin.env
set +a
DATABASE_URL="$MIGRATION_DATABASE_URL" pnpm exec drizzle-kit migrate
pnpm check
pnpm test
pnpm build
pm2 restart autofin
pm2 status
```

O CloudPanel realiza dump noturno dos bancos e retém sete dias por padrão; as cópias ficam em `/home/<site-user>/backups/`. [3] Isso não substitui um backup externo. Configure **Remote Backups** para um provedor independente e teste restaurações periodicamente. [5]

| Verificação | Resultado esperado |
| --- | --- |
| Processo | `pm2 status` mostra `autofin` como `online`. |
| Porta interna | `curl -I http://127.0.0.1:3000` responde sem expor a aplicação à internet. |
| Domínio | `curl -I https://autofin.seudominio.com` responde via TLS válido. |
| Banco | Migração termina sem erro e a conta de app não possui privilégios DDL. |
| Segredos | `~/.config/autofin.env` tem permissão `600`. |
| Administrador | `LOCAL_ADMIN_SETUP_TOKEN` foi removido após o primeiro cadastro. |
| Backup | Existe cópia remota e uma restauração foi testada. |

## Referências

[1] [CloudPanel — Add Site](https://www.cloudpanel.io/docs/v2/frontend-area/add-site/)

[2] [CloudPanel — Node.js deployment with PM2](https://www.cloudpanel.io/docs/v2/nodejs/deployment/pm2/)

[3] [CloudPanel — Databases](https://www.cloudpanel.io/docs/v2/frontend-area/databases/)

[4] [CloudPanel — SSL/TLS Certificates](https://www.cloudpanel.io/docs/v2/frontend-area/tls/)

[5] [CloudPanel — Security best practices](https://www.cloudpanel.io/docs/v2/guides/best-practices/security/)
