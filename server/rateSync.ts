const BCB_VEHICLE_RATES_URL =
  "https://olinda.bcb.gov.br/olinda/servico/taxaJuros/versao/v2/odata/TaxasJurosDiariaPorInicioPeriodo";

const vehicleFilter =
  "Segmento eq 'PESSOA FÍSICA' and Modalidade eq 'Aquisição de veículos (Taxa pré-fixada para Pessoa física)'";

type BcbRatePayload = {
  InstituicaoFinanceira?: string;
  TaxaJurosAoMes?: number | string;
  TaxaJurosAoAno?: number | string;
  InicioPeriodo?: string;
  FimPeriodo?: string;
  cnpj8?: string;
};

export type BcbVehicleRate = {
  institutionName: string;
  cnpj8: string;
  monthlyRate: number;
  annualRate: number | null;
  referenceStart: string | null;
  referenceEnd: string | null;
};

export const BCB_SOURCE_URL = `${BCB_VEHICLE_RATES_URL}?$top=1000&$format=json`;

export async function fetchBcbVehicleRates(): Promise<BcbVehicleRate[]> {
  const url = new URL(BCB_VEHICLE_RATES_URL);
  url.searchParams.set("$format", "json");
  url.searchParams.set("$top", "1000");
  url.searchParams.set("$filter", vehicleFilter);
  url.searchParams.set(
    "$select",
    "InstituicaoFinanceira,TaxaJurosAoMes,TaxaJurosAoAno,InicioPeriodo,FimPeriodo,cnpj8",
  );

  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), 15_000);
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: abortController.signal,
    });
    if (!response.ok) {
      throw new Error(`A fonte oficial retornou HTTP ${response.status}.`);
    }
    const payload = (await response.json()) as { value?: BcbRatePayload[] };
    if (!Array.isArray(payload.value)) {
      throw new Error("A fonte oficial retornou um formato inesperado.");
    }

    return payload.value.flatMap(item => {
      const monthlyRate = Number(item.TaxaJurosAoMes);
      const cnpj8 = String(item.cnpj8 ?? "").replace(/\D/g, "");
      if (!item.InstituicaoFinanceira || !cnpj8 || !Number.isFinite(monthlyRate) || monthlyRate <= 0) {
        return [];
      }
      return [{
        institutionName: item.InstituicaoFinanceira,
        cnpj8,
        monthlyRate,
        annualRate: Number.isFinite(Number(item.TaxaJurosAoAno)) ? Number(item.TaxaJurosAoAno) : null,
        referenceStart: normalizeDate(item.InicioPeriodo),
        referenceEnd: normalizeDate(item.FimPeriodo),
      }];
    });
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeDate(value: string | undefined) {
  const match = value?.match(/\d{4}-\d{2}-\d{2}/);
  return match?.[0] ?? null;
}
