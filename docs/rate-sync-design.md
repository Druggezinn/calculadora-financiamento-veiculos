# Atualização Manual de Taxas

## Fonte adotada

O botão de atualização consultará o serviço público OData **Taxas de juros de operações de crédito - v2**, do Banco Central do Brasil. A consulta será limitada à modalidade **Aquisição de veículos (Taxa pré-fixada para Pessoa Física)** e buscará os registros publicados mais recentes por instituição financeira.

O recurso diário publicado pelo Banco Central é `TaxasJurosDiariaPorInicioPeriodo`. A resposta documentada disponibiliza o nome da instituição, a taxa mensal e anual, CNPJ-base, início e fim do período, segmento e modalidade. A integração aceitará apenas respostas com taxa mensal numérica, período válido e correspondência inequívoca com uma financeira cadastrada.

O explorador oficial confirmou que o recurso aceita seleção de campos, paginação, filtro e ordenação, e expõe a URL-base `https://olinda.bcb.gov.br/olinda/servico/taxaJuros/versao/v2/odata/TaxasJurosDiariaPorInicioPeriodo?$top=100&$format=json`. A sincronização usará o CNPJ-base persistido em cada financeira como chave principal de correspondência e restringirá a resposta à modalidade e ao segmento esperados antes de alterar valores.

O serviço do Banco Central descreve os dados como médias das taxas pactuadas no período divulgado. Por essa razão, a aplicação tratará cada valor retornado como **taxa de referência**: não como uma proposta de crédito nem como uma taxa garantida ao cliente.

## Regras de sincronização

| Regra | Implementação |
| --- | --- |
| Ação explícita | A consulta só será feita quando um administrador pressionar o botão de atualizar. Não haverá rotina oculta ou coleta recorrente. |
| Correspondência | Somente as instituições cadastradas e reconhecidas serão atualizadas. Registros ausentes, ambíguos ou sem taxa válida serão preservados e reportados. |
| Rastreabilidade | Cada execução registrará data, operador, fonte, período de referência, valores anteriores, valores novos e eventuais falhas. |
| Proteção | A operação será limitada ao perfil administrativo e validará a resposta da fonte antes de gravar qualquer alteração. |
| Transparência | A interface exibirá a data de referência e manterá o aviso de que o CET e as parcelas são estimativas. |

> O painel público do Banco Central e a documentação OData foram consultados em 18 de agosto de 2026. A URL oficial será persistida junto com cada atualização para rastreabilidade.
