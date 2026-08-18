# Segurança Administrativa e VPS

## Objetivo e limite

O projeto será reforçado com controles de autorização, validação, auditoria e boas práticas de implantação. **Nenhum software pode ser declarado “totalmente seguro”**: a proteção efetiva também depende do domínio HTTPS, do provedor de identidade, da VPS, do banco de dados, das credenciais e da operação contínua. O produto será preparado para uma postura de defesa em camadas.

## Modelo de acesso administrativo

O painel administrativo continuará separado da calculadora pública. Toda alteração de taxa, marca ou sincronização exigirá uma sessão autenticada e a função `admin`; o servidor validará essa função em cada operação, sem confiar em controles visuais do navegador.

Para a VPS, a recomendação de produção é usar um **provedor OAuth/OpenID Connect** com autenticação multifator para a conta administradora e permitir somente as identidades configuradas como administradoras. O fluxo OAuth já empregado na aplicação possui proteção contra CSRF por `state` e nonce; a implantação externa precisará apontar para um provedor que o usuário controle e configurar as URLs de redirecionamento no domínio final.

| Camada | Controle a ser aplicado |
| --- | --- |
| Identidade | OAuth/OpenID Connect com MFA no provedor e lista explícita de administradores. |
| Sessão | Cookies `Secure`, `HttpOnly`, sem segredo exposto ao frontend e HTTPS obrigatório. |
| API | Procedimentos administrativos protegidos por função, esquema Zod restritivo e respostas sem segredos. |
| Dados | Conta MySQL com privilégio mínimo, `DATABASE_URL` fora do código e backups cifrados. |
| Operação | Nginx como proxy, TLS renovado, firewall restrito, atualizações do sistema e logs monitorados. |
| Rastreabilidade | Auditoria com operador, ação, alvo, valores anteriores/novos, IP quando disponibilizado pelo proxy e horário UTC. |

## Decisão de taxa automática

O produto não fará atualização silenciosa. O administrador acionará a consulta, avaliará o retorno da fonte e a aplicação só gravará correspondências de instituição sem ambiguidade. Esse comportamento reduz o risco de uma mudança de fonte alterar taxas sem revisão, mantendo a atualização rápida quando necessária.

## Configuração ainda necessária para uma VPS externa

Antes da exposição pública, o proprietário deverá escolher e configurar o provedor de identidade compatível (por exemplo, um provedor OpenID Connect corporativo), registrar o domínio HTTPS como URL de redirecionamento, definir o identificador do administrador e guardar os segredos exclusivamente no ambiente da VPS. A aplicação não armazenará senhas de administrador em texto nem criará um login caseiro sem esse provedor.
