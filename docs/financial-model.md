# Modelo Financeiro do Produto

## Escopo

O produto calcula uma **simulação comercial indicativa**, não uma proposta de crédito. Ele parte do preço do veículo e da entrada, adiciona o IOF informado na configuração e aplica uma taxa mensal escolhida para cada financeira. Tarifas bancárias adicionais, seguros, registro de contrato, gravame, despachante, serviços de terceiros e condições promocionais não serão presumidos; quando conhecidos, poderão ser incorporados em evolução posterior como custos opcionais.

## Variáveis

| Símbolo | Definição | Origem |
| --- | --- | --- |
| `V` | Valor do veículo | Entrada do usuário. |
| `E` | Valor da entrada | Entrada do usuário. |
| `P` | Principal sem IOF | `max(V - E, 0)`. |
| `i` | Taxa efetiva mensal | Cadastro editável da financeira. |
| `n` | Número de parcelas mensais | Entrada do usuário ou resultado do modo por parcela. |
| `d` | Prazo em dias | `n × 30`, convenção explícita do produto. |
| `IOF` | Imposto sobre Operações Financeiras | Fórmula configurada conforme solicitação, limitada e documentada quando a norma aplicável exigir. |
| `PV` | Valor financiado para amortização | `P + IOF`. |

## Fórmulas propostas

O IOF será calculado inicialmente conforme a regra solicitada: `IOF = P × (0,0038 + 0,000082 × d)`. O motor aplicará o limite legal configurável antes de exibir o resultado, para evitar extrapolação quando a regra tributária aplicável o determinar.

Para um prazo conhecido, o sistema utilizará a tabela Price: `PMT = PV × [i × (1+i)^n] / [(1+i)^n - 1]`. Para taxa mensal igual a zero, será aplicado o caso limite `PMT = PV / n`.

Para uma parcela-alvo conhecida, o prazo teórico será `n = -ln(1 - i × PV / PMT) / ln(1+i)`. A interface mostrará o primeiro inteiro de meses cujo valor de parcela não exceda o teto informado, dentro da faixa operacional definida no cadastro; se a parcela-alvo não amortizar os juros ou não houver prazo elegível, apresentará uma explicação em vez de um número inválido.

O **CET estimado** exibido será a taxa efetiva mensal equivalente que reconcilia `P` com a série de parcelas calculadas, considerando o IOF incorporado. Ele não substitui o CET contratual da instituição, pois não inclui custos que não foram informados.

## Padrões de apresentação e persistência

A aplicação preservará internamente precisão decimal e arredondará somente na interface monetária. O histórico será mantido no `sessionStorage`, exclusivamente na sessão atual. As taxas e respectivas fontes serão mantidas em banco por data de vigência e editadas apenas por perfil administrativo autenticado.

