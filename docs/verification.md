# Registro de Verificação

## 18 de agosto de 2026 — formulário público

No navegador de desenvolvimento, foi preenchido o cenário de teste com veículo de R$ 75.000,00, entrada de R$ 20.000,00 e parcela-alvo de R$ 1.800,00. O campo calculado exibiu corretamente valor financiado de R$ 55.000,00 antes da execução do comparativo.

Após o cálculo, o comparativo retornou cinco propostas elegíveis e identificou Santander como menor custo total: 47 parcelas de R$ 1.795,58, total de R$ 84.392,03 e CET estimado de 1,94% ao mês. O histórico da sessão exibiu o cenário e o resultado líder. As taxas que não atingem a parcela-alvo passaram a ser exibidas com a justificativa de indisponibilidade no prazo máximo.

Também foram confirmados no navegador o `manifest.webmanifest`, o `apple-touch-icon` e o service worker em estado `activated`, com controlador ativo no escopo da aplicação.

No segundo fluxo, o modo por número de parcelas foi selecionado com veículo de R$ 75.000,00, entrada de R$ 20.000,00 e prazo de 48 meses. O formulário atualizou corretamente o rótulo e preservou o valor financiado de R$ 55.000,00 antes do cálculo.

O cálculo por 48 parcelas retornou as seis financeiras configuradas. Santander apresentou a menor parcela e o menor total no cenário observado: 48x de R$ 1.771,59, total de R$ 85.036,16 e CET estimado de 1,94% ao mês. PAN também foi exibido, com 48x de R$ 2.204,74 e total de R$ 105.827,36.

Após evoluir o service worker para a versão de app shell, o navegador recebeu a solicitação de atualização sem registrar worker pendente ou em instalação. A verificação de chaves de cache será feita após a navegação de recarga controlada.

Após a recarga controlada, o cache `autofin-shell-v2` continha os três ícones PWA e os recursos do app shell carregados pelo Vite, incluindo o módulo principal, a folha de estilos e os módulos da tela de cálculo. O service worker também mantém fallback de navegação para a raiz quando a rede não está disponível.
