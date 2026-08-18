# Registro de Depuração da Renderização

Em 18 de agosto de 2026, após reinicializar o servidor e deduplicar React no Vite, uma sessão limpa do navegador ainda exibiu somente o plano de fundo da página. O console dessa nova sessão não apresentou mensagens. A próxima verificação deve distinguir entre raiz React vazia, falha de carregamento do módulo principal e erro de renderização que não foi registrado no console.

Também foi removido o service worker e um cache de navegação da PWA na sessão de depuração, para descartar a entrega de um app shell antigo pelo cache offline.

A nova carga da prévia confirmou que o dashboard renderiza normalmente sem o cache antigo. O registro PWA foi ajustado para não instalar service worker quando a variável global de prévia de desenvolvimento estiver ativa; em produção, o registro PWA permanece habilitado.
