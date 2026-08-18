# Fontes de Taxas e Regra de IOF

**Data de referência:** 18 de agosto de 2026 (GMT-3).

## Banco Central do Brasil — taxas de veículos

O Banco Central disponibiliza médias de taxas de juros de operações de crédito **por instituição financeira**, incluindo a modalidade de pessoa física “Aquisição de veículos”. Os valores incluem juros e encargos fiscais e operacionais das operações, e a apuração usa média aritmética ponderada pelos valores contratados. A própria fonte alerta que as taxas variam conforme cadastro, entrada e garantias.

| Fonte | Uso no produto | URL |
| --- | --- | --- |
| Painel de taxas de juros | Fonte oficial de conferência, modalidade “Aquisição de veículos” | https://www.bcb.gov.br/estatisticas/txjuros |
| Dados abertos — taxas por instituição | Origem pública para verificação manual e eventual importação futura, não automática nesta versão | https://dadosabertos.bcb.gov.br/dataset/taxas-de-juros-de-operacoes-de-credito |
| API OData do BCB | Endpoint documentado: `TaxasJurosDiariaPorInicioPeriodo` e `TaxasJurosMensalPorMes` | https://olinda.bcb.gov.br/olinda/servico/taxaJuros/versao/v2/documentacao |

> **Decisão de produto:** as taxas serão cadastradas no banco pelo proprietário, com percentual mensal, fonte e data de vigência. Não haverá coleta automática de taxas na primeira versão: a metodologia das instituições e o perfil individual do cliente tornam inadequado apresentar um dado de média pública como proposta comercial individual.

## IOF — pessoa física

O Decreto nº 6.306/2007, em texto compilado, prevê para mutuário pessoa física alíquota diária de `0,0082%`; o § 1º do art. 7º estabelece limite de 365 dias para a parcela diária quando aplicável. A alíquota adicional de `0,38%` está expressa no § 15 do art. 7º. Para a simulação, o sistema utilizará a fórmula solicitada e aplicará o teto de dias de 365 antes do cálculo.

| Parâmetro | Valor inicial configurado | Referência |
| --- | --- | --- |
| IOF adicional | 0,38% | Decreto nº 6.306/2007, art. 7º, § 15. |
| IOF diário — PF | 0,0082% ao dia | Decreto nº 6.306/2007, art. 7º, I, “b”, item 2, texto compilado. |
| Teto de dias | 365 dias | Decreto nº 6.306/2007, art. 7º, § 1º. |

**Fonte primária:** https://www.planalto.gov.br/ccivil_03/_ato2007-2010/2007/decreto/d6306.htm

## Parâmetros iniciais para cadastro

Os seguintes valores correspondem às médias recentes divulgadas pelo Banco Central para a modalidade **“Aquisição de veículos - Prefixado”**, pessoa física, com período de 28 de julho a 3 de agosto de 2026. Eles são parâmetros iniciais editáveis, não ofertas vinculantes. A linha de Bradesco selecionada é a de **Bradesco Financiamentos**, por ser a entidade identificada especificamente para financiamento.

| Financeira exibida | Instituição identificada na base do BCB | Taxa mensal inicial | Taxa anual divulgada | CNPJ-base | Período de referência |
| --- | --- | ---: | ---: | --- | --- |
| Itaú | ITAÚ UNIBANCO HOLDING S.A. | 2,05% | 27,64% | 60872504 | 28/07/2026–03/08/2026 |
| Bradesco | BCO BRADESCO FINANC. S.A. | 1,89% | 25,22% | 07207996 | 28/07/2026–03/08/2026 |
| BV | BCO VOTORANTIM S.A. | 2,27% | 30,90% | 59588111 | 28/07/2026–03/08/2026 |
| Santander | SANTANDER SCFI S.A. | 1,78% | 23,58% | 07707650 | 28/07/2026–03/08/2026 |
| PAN | BANCO PAN | 2,89% | 40,70% | 59285411 | 28/07/2026–03/08/2026 |
| Honda Financial | BCO HONDA S.A. | 2,32% | 31,64% | 03634220 | 28/07/2026–03/08/2026 |

**Fonte de todos os valores desta tabela:** API de Dados Abertos do Banco Central, recurso `TaxasJurosDiariaPorInicioPeriodo`, filtrado por pessoa física e modalidade “Aquisição de veículos - Prefixado”. Documentação: https://olinda.bcb.gov.br/olinda/servico/taxaJuros/versao/v2/documentacao
