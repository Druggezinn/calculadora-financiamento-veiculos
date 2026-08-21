# Instalação automatizada: Amazon EC2 com Ubuntu

O script `scripts/install-ec2-ubuntu.sh` prepara uma instância **Amazon EC2 com Ubuntu 24.04 ou 22.04**, sem cPanel. Ele instala Node.js 20, pnpm, MySQL local, Nginx, Certbot, firewall local, a aplicação AutoFin e o serviço `systemd`.

> A instância deve ter pelo menos **2 GB de RAM**. Antes de executar o script, no **Security Group** da EC2, permita SSH na porta 22 apenas para seu IP e HTTP/HTTPS nas portas 80 e 443. A regra de Security Group é independente do firewall UFW configurado pelo script.

## Pré-requisitos

| Requisito | Configuração |
| --- | --- |
| Imagem EC2 | Ubuntu Server 24.04 LTS ou 22.04 LTS. |
| Recursos | Pelo menos 2 GB de RAM e 20 GB de armazenamento. |
| Acesso | Usuário SSH normal com `sudo`; não conecte como root para executar o script. |
| Git privado | Uma chave SSH válida no usuário SSH da EC2, com acesso de leitura ao repositório. |
| DNS | Registro `A` do domínio apontando para o IP público ou Elastic IP da instância antes do HTTPS. |

## Execução

Clone o repositório na instância com o seu usuário SSH e entre na pasta. Para repositórios privados, verifique primeiro se `ssh -T git@github.com` reconhece sua chave.

```bash
git clone <URL_DO_REPOSITORIO> autofin-installer
cd autofin-installer
sudo bash scripts/install-ec2-ubuntu.sh
```

O instalador solicita a URL Git a ser instalada, o domínio, o e-mail do certificado e se o HTTPS deve ser emitido no momento. Ele cria dois usuários MySQL — um com permissões reduzidas para a aplicação e outro reservado a migrações — e salva os segredos em `/etc/autofin/autofin.config`, com acesso restrito ao serviço.

Depois do término, abra o domínio, use o token exibido no terminal em **Acesso do dono** para criar o primeiro administrador e revogue-o:

```bash
sudo sed -i '/^LOCAL_ADMIN_SETUP_TOKEN=/d' /etc/autofin/autofin.config
sudo systemctl restart autofin
```

## Operação e diagnóstico

| Objetivo | Comando |
| --- | --- |
| Verificar serviço | `sudo systemctl status autofin --no-pager` |
| Ver logs | `sudo journalctl -u autofin -f` |
| Reiniciar após atualização | `sudo systemctl restart autofin` |
| Verificar Nginx | `sudo nginx -t && sudo systemctl reload nginx` |
| Renovar certificado | `sudo certbot renew --dry-run` |

Para atualizar o código em produção, use o guia detalhado em [`guia-instalacao-vps.md`](./guia-instalacao-vps.md). O logo editável depende de armazenamento S3 compatível quando a AutoFin é executada fora do ambiente gerenciado.
