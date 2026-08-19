# Revisão de segurança — AutoFin

**Data da revisão:** 19 de agosto de 2026.  
**Escopo:** aplicação React/Express/tRPC, autenticação administrativa local, dependências de produção e instruções de implantação em VPS. Esta revisão avaliou código e configuração; não substitui teste externo de intrusão, monitoramento contínuo ou a proteção operacional da VPS.

## Resultado executivo

A aplicação mantém controles apropriados para um painel administrativo de uso restrito: senha com Argon2id, sessões opacas armazenadas somente como hash, expiração e revogação de sessão, bloqueio de repetidas tentativas por usuário, validação de entrada com Zod e autorização administrativa centralizada. A revisão adicionou endurecimento HTTP, limites de corpo compatíveis com o único upload permitido, validação mais estrita de identificadores e atualização de dependências. A auditoria final de dependências de produção não reportou vulnerabilidades.

| Área | Situação após a revisão | Evidência |
| --- | --- | --- |
| Autenticação administrativa | Adequada | Argon2id, token de sessão aleatório de 256 bits, hash SHA-256 persistido, cookie HttpOnly/Secure/SameSite e expiração de 8 horas. |
| Controle de acesso | Adequado | Mutações de taxa e marca exigem `adminProcedure`; operações são registradas em auditoria. |
| Proteção contra abuso | Reforçada | Limite de cinco falhas em 15 minutos por usuário, bloqueio temporário e limite de corpo JSON de 2 MB. |
| Superfície HTTP | Reforçada | Cabeçalhos contra framing, MIME sniffing, objetos/plugins e referências excessivas; API de escrita aceita somente JSON. |
| Dependências | Sem achados reportados | `pnpm audit --prod` finalizou com 0 vulnerabilidades em todos os níveis. |
| VPS e banco de dados | Reforçada | Guia passou a separar a conta de execução da conta de migração e a restringir o serviço e o proxy. |

## Correções aplicadas

### Servidor e API

O Express deixa de anunciar sua tecnologia e devolve uma política de conteúdo, isolamento de origem, restrições de recursos do navegador, política de permissões, política de referência, bloqueio de MIME sniffing e bloqueio de incorporação em frames. Em produção, a aplicação também envia HSTS. O processo Node escuta em `127.0.0.1` apenas em produção, deixando a exposição pública exclusivamente para o Nginx; no desenvolvimento ele usa `0.0.0.0` para manter a prévia disponível.

O analisador de URL codificado foi removido porque a aplicação usa tRPC com JSON. As mutações em `/api/trpc` recusam conteúdos que não sejam JSON e o corpo é limitado a 2 MB, acomodando o Data URI de logo já limitado a 1 MB. Essas medidas reduzem vetores de parsing de formulários e de consumo indevido de memória.

### Autenticação e entrada

Nomes de usuário agora aceitam somente letras minúsculas, números, ponto, hífen e sublinhado, iniciando por caractere alfanumérico e com comprimento de 3 a 64 caracteres. A verificação Argon2id trata hashes malformados como uma credencial inválida, evitando propagação de erro não tratada. A senha continua exigindo entre 12 e 128 caracteres, e as mensagens de login não revelam a existência da conta.

### Dependências

Foram atualizados `@trpc/*`, AWS SDK, Axios, Streamdown, Express, Drizzle ORM, Nano ID e Recharts. A migração para Express 5 incluiu a adaptação segura das rotas curinga e dos fallbacks de SPA; o componente de gráfico foi atualizado para os contratos de tipo da versão corrigida do Recharts. Ao final, a auditoria de produção informou **0 vulnerabilidades**.

### Implantação em VPS

O guia agora orienta duas contas MySQL locais: `autofin_app`, com apenas `SELECT`, `INSERT`, `UPDATE` e `DELETE`, e `autofin_migrate`, usada somente para migrações. O arquivo de ambiente ganhou `MIGRATION_DATABASE_URL`, e os comandos de migração usam essa credencial explicitamente. Também foram acrescentados `UMask=0077` e restrições adicionais do `systemd`; o guia deixou de imprimir o arquivo de segredos no terminal e fortaleceu a configuração Nginx com HSTS e CSP.

## Validação executada

| Verificação | Resultado |
| --- | --- |
| `pnpm check` | Aprovada. |
| `pnpm test` | Aprovada: 9 arquivos e 21 testes. |
| `pnpm build` | Aprovada. |
| `pnpm audit --prod --json` | 0 informativas, 0 baixas, 0 moderadas, 0 altas e 0 críticas. |
| Cabeçalhos HTTP locais | CSP, Permissions-Policy, Referrer-Policy, X-Content-Type-Options e X-Frame-Options confirmados. |
| Interface após endurecimento | Prévia restaurada e carregada normalmente após a atualização do Express. |

## Recomendações operacionais

O token `LOCAL_ADMIN_SETUP_TOKEN` deve ser removido do arquivo privado assim que o primeiro administrador for criado. Mantenha somente as portas 22, 80 e 443 abertas no firewall, não exponha a porta 3000 nem o MySQL à internet, e renove o certificado HTTPS automaticamente. O backup deve permanecer cifrado fora da VPS e as atualizações devem sempre executar testes, build e auditoria antes da reinicialização do serviço.

A política de conteúdo admite scripts inline porque a interface aplica o tema antes da primeira renderização e registra o service worker em scripts pequenos no documento. Se a aplicação passar a receber conteúdo HTML de terceiros ou incluir novos scripts externos, esta política deve ser revista para substituir scripts inline por nonces ou hashes. Também é recomendável incluir `pnpm audit --prod` no pipeline de atualização da VPS e, quando houver acesso de múltiplos operadores, adicionar limitação de login por IP no proxy Nginx.
