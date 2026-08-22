export const INITIAL_RATE_REFERENCE_URL =
  "https://olinda.bcb.gov.br/olinda/servico/taxaJuros/versao/v2/documentacao";

export const INITIAL_RATE_REFERENCE_DESCRIPTION =
  "Média de referência do Banco Central para aquisição de veículos — pessoa física; parâmetro inicial editável, não é oferta vinculante.";

export const INITIAL_FINANCIAL_INSTITUTIONS = [
  {
    slug: "itau",
    displayName: "Itaú",
    legalName: "ITAÚ UNIBANCO HOLDING S.A.",
    bcbCnpj8: "60872504",
    monthlyRate: 2.05,
    annualRate: 27.64,
    sortOrder: 1,
  },
  {
    slug: "bradesco",
    displayName: "Bradesco",
    legalName: "BCO BRADESCO FINANC. S.A.",
    bcbCnpj8: "07207996",
    monthlyRate: 1.89,
    annualRate: 25.22,
    sortOrder: 2,
  },
  {
    slug: "bv",
    displayName: "BV",
    legalName: "BCO VOTORANTIM S.A.",
    bcbCnpj8: "59588111",
    monthlyRate: 2.27,
    annualRate: 30.9,
    sortOrder: 3,
  },
  {
    slug: "santander",
    displayName: "Santander",
    legalName: "SANTANDER SCFI S.A.",
    bcbCnpj8: "07707650",
    monthlyRate: 1.78,
    annualRate: 23.58,
    sortOrder: 4,
  },
  {
    slug: "pan",
    displayName: "PAN",
    legalName: "BANCO PAN",
    bcbCnpj8: "59285411",
    monthlyRate: 2.89,
    annualRate: 40.7,
    sortOrder: 5,
  },
  {
    slug: "honda-financial",
    displayName: "Honda Financial",
    legalName: "BCO HONDA S.A.",
    bcbCnpj8: "03634220",
    monthlyRate: 2.32,
    annualRate: 31.64,
    sortOrder: 6,
  },
] as const;
