# Registro de Verificação

## 18 de agosto de 2026 — formulário público

No navegador de desenvolvimento, foi preenchido o cenário de teste com veículo de R$ 75.000,00, entrada de R$ 20.000,00 e parcela-alvo de R$ 1.800,00. O campo calculado exibiu corretamente valor financiado de R$ 55.000,00 antes da execução do comparativo.

Após o cálculo, o comparativo retornou cinco propostas elegíveis e identificou Santander como menor custo total: 47 parcelas de R$ 1.795,58, total de R$ 84.392,03 e CET estimado de 1,94% ao mês. O histórico da sessão exibiu o cenário e o resultado líder. As taxas que não atingem a parcela-alvo passaram a ser exibidas com a justificativa de indisponibilidade no prazo máximo.

Também foram confirmados no navegador o `manifest.webmanifest`, o `apple-touch-icon` e o service worker em estado `activated`, com controlador ativo no escopo da aplicação.

No segundo fluxo, o modo por número de parcelas foi selecionado com veículo de R$ 75.000,00, entrada de R$ 20.000,00 e prazo de 48 meses. O formulário atualizou corretamente o rótulo e preservou o valor financiado de R$ 55.000,00 antes do cálculo.

O cálculo por 48 parcelas retornou as seis financeiras configuradas. Santander apresentou a menor parcela e o menor total no cenário observado: 48x de R$ 1.771,59, total de R$ 85.036,16 e CET estimado de 1,94% ao mês. PAN também foi exibido, com 48x de R$ 2.204,74 e total de R$ 105.827,36.

Após evoluir o service worker para a versão de app shell, o navegador recebeu a solicitação de atualização sem registrar worker pendente ou em instalação. A verificação de chaves de cache será feita após a navegação de recarga controlada.

Após a recarga controlada, o cache `autofin-shell-v2` continha os três ícones PWA e os recursos do app shell carregados pelo Vite, incluindo o módulo principal, a folha de estilos e os módulos da tela de cálculo. O service worker também mantém fallback de navegação para a raiz quando a rede não está disponível.

## 18 de agosto de 2026 — provisionamento administrativo

O botão de acesso administrativo foi verificado no navegador. Sem um administrador local provisionado, a aplicação abriu o formulário de criação inicial com campos para usuário, senha forte e token privado de provisionamento. O diálogo foi fechado sem inserir credenciais de teste.

## 18 de agosto de 2026 — proposta em PDF

No cenário de veículo de R$ 75.000,00, entrada de R$ 20.000,00 e parcela-alvo de R$ 1.800,00, o comparativo exibiu as propostas elegíveis, o estado de indisponibilidade da financeira PAN e o botão **Exportar PDF**. O botão só aparece quando há resultados calculados, preservando a coerência do fluxo de proposta.

O acionamento de **Exportar PDF** exibiu a confirmação de geração no navegador e produziu o arquivo `proposta-autofin.pdf` com 9.540 bytes no diretório de downloads da sessão de teste.

## 18 de agosto de 2026 — modo escuro

O alternador de tema foi verificado no navegador. Ao ativar o modo escuro, a interface adotou superfícies verde-petróleo escuras, texto claro e grid de fundo de baixo contraste. O botão alterou seu rótulo acessível de **Ativar modo escuro** para **Ativar modo claro**, confirmando o estado da preferência.

Após recarregar a aplicação, o modo escuro permaneceu ativo. A verificação no navegador confirmou `localStorage.theme = "dark"` e a classe `dark` aplicada ao elemento raiz do documento.

Após tokenizar as superfícies, o cenário de R$ 75.000,00 com entrada de R$ 20.000,00 e parcela de R$ 1.800,00 foi preenchido em modo escuro. Os campos, textos de formulário, valor financiado e ação principal permaneceram legíveis sobre as superfícies escuras.

O cálculo exibiu os cards comparativos, a proposta de menor custo, o card de indisponibilidade, o histórico e o painel de transparência com contraste consistente. O diálogo de criação inicial do administrador também foi aberto em modo escuro, com cabeçalho, campos e botão de ação legíveis.

Na nova carga do dashboard tokenizado, o estado de carregamento exibiu superfícies escuras, skeletons e texto de progresso legíveis. Após a consulta, o estado vazio do comparativo também preservou contraste entre ícone, título, descrição, bordas e fundo.

A captura pós-tokenização no viewport de iPhone confirmou que o alternador de tema permanece acessível no cabeçalho compacto e que os cards de cenário, comparativo, histórico e transparência mantêm hierarquia e espaçamento adequados no layout mobile.

Para validar o estado de erro sem alterar dados da aplicação, foi preparada uma falha de consulta controlada no navegador em modo escuro. A verificação subsequente revisará a resposta visual do comparativo e restaurará o comportamento normal da página.

A tentativa não alterou o estado de consulta já resolvido do cliente; o comparativo retornou ao estado vazio normal. A função de rede original foi restaurada imediatamente. Os estilos de erro permanecem cobertos por tokens semânticos no código, sem impacto nos dados ou na operação do navegador.

Uma inspeção posterior para acessar o cliente de consultas não localizou uma árvore React exposta na sessão de navegador; nenhuma modificação adicional de estado foi realizada. A validação do estado de erro permanece documentada como pendente para uma sessão autenticada ou ambiente de teste de interface dedicado.

Com os estados de revisão exclusivos do desenvolvimento, o comparativo exibiu o erro de carregamento em modo escuro com ícone, mensagem e ação de nova tentativa legíveis. A visualização administrativa exibiu o botão **Gerenciar taxas** no cabeçalho preservando o contraste do estado protegido, sem conceder permissão real ou executar qualquer alteração de dados.

O diálogo administrativo de revisão foi aberto sem submeter formulários. As superfícies, tipografia, campos de taxa, seletor de logo, controles de sincronização e botões de ação permaneceram legíveis sobre o fundo escuro.
