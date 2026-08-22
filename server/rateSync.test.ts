import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchBcbVehicleRates } from "./rateSync";

describe("sincronização de taxas do Banco Central", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("aceita somente registros completos com taxa mensal válida e CNPJ-base", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        value: [
          {
            InstituicaoFinanceira: "BCO EXEMPLO S.A.",
            TaxaJurosAoMes: "1.95",
            TaxaJurosAoAno: "26.00",
            InicioPeriodo: "2026-08-03T00:00:00",
            FimPeriodo: "2026-08-07T00:00:00",
            cnpj8: "12345678",
            codigoSegmento: "1",
            codigoModalidade: "401101",
          },
          {
            InstituicaoFinanceira: "Registro antigo",
            TaxaJurosAoMes: "1.5",
            InicioPeriodo: "2026-07-28T00:00:00",
            FimPeriodo: "2026-08-01T00:00:00",
            cnpj8: "12345678",
            codigoSegmento: "1",
            codigoModalidade: "401101",
          },
          {
            InstituicaoFinanceira: "Modalidade diferente",
            TaxaJurosAoMes: "3.2",
            cnpj8: "87654321",
            codigoSegmento: "1",
            codigoModalidade: "402101",
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchBcbVehicleRates()).resolves.toEqual([
      {
        institutionName: "BCO EXEMPLO S.A.",
        cnpj8: "12345678",
        monthlyRate: 1.95,
        annualRate: 26,
        referenceStart: "2026-08-03",
        referenceEnd: "2026-08-07",
      },
    ]);

    const requestedUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(requestedUrl.pathname).toContain("ConsultaUnificada");
    expect(requestedUrl.searchParams.get("$filter")).toBeNull();
    expect(requestedUrl.searchParams.get("$select")).toContain("codigoModalidade");
    expect(requestedUrl.searchParams.get("$select")).toContain("cnpj8");
  });
});
