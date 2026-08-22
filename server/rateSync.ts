export const BCB_VEHICLE_RATES_URL =
  "https://olinda.bcb.gov.br/olinda/servico/taxaJuros/versao/v2/odata/ConsultaUnificada";

const VEHICLE_SEGMENT_CODE = "1";
const VEHICLE_MODALITY_CODE = "401101";
export const BCB_REQUEST_TIMEOUT_MS = 45_000;

type BcbRatePayload = {
  InstituicaoFinanceira?: string;
  TaxaJurosAoMes?: number | string;
  TaxaJurosAoAno?: number | string;
  InicioPeriodo?: string;
  FimPeriodo?: string;
  cnpj8?: string;
  codigoSegmento?: string | number | null;
  codigoModalidade?: string | number | null;
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
  url.searchParams.set(
    "$select",
    "InstituicaoFinanceira,TaxaJurosAoMes,TaxaJurosAoAno,InicioPeriodo,FimPeriodo,cnpj8,codigoSegmento,codigoModalidade",
  );

  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), BCB_REQUEST_TIMEOUT_MS);
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

    const latestRatesByCnpj = new Map<string, BcbVehicleRate>();
    for (const item of payload.value) {
      if (
        String(item.codigoSegmento ?? "") !== VEHICLE_SEGMENT_CODE ||
        String(item.codigoModalidade ?? "") !== VEHICLE_MODALITY_CODE
      ) {
        continue;
      }

      const monthlyRate = Number(item.TaxaJurosAoMes);
      const cnpj8 = String(item.cnpj8 ?? "").replace(/\D/g, "");
      if (!item.InstituicaoFinanceira || !cnpj8 || !Number.isFinite(monthlyRate) || monthlyRate <= 0) {
        continue;
      }

      const rate: BcbVehicleRate = {
        institutionName: item.InstituicaoFinanceira,
        cnpj8,
        monthlyRate,
        annualRate: Number.isFinite(Number(item.TaxaJurosAoAno)) ? Number(item.TaxaJurosAoAno) : null,
        referenceStart: normalizeDate(item.InicioPeriodo),
        referenceEnd: normalizeDate(item.FimPeriodo),
      };
      const existing = latestRatesByCnpj.get(cnpj8);
      if (!existing || rateDate(rate) > rateDate(existing)) {
        latestRatesByCnpj.set(cnpj8, rate);
      }
    }

    return Array.from(latestRatesByCnpj.values()).sort((a, b) =>
      a.institutionName.localeCompare(b.institutionName, "pt-BR"),
    );
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeDate(value: string | undefined) {
  const match = value?.match(/\d{4}-\d{2}-\d{2}/);
  return match?.[0] ?? null;
}

function rateDate(rate: BcbVehicleRate) {
  return rate.referenceEnd ?? rate.referenceStart ?? "";
}
