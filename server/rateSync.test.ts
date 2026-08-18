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
          },
          { InstituicaoFinanceira: "Registro inválido", TaxaJurosAoMes: "0", cnpj8: "" },
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
    expect(requestedUrl.searchParams.get("$filter")).toContain("Aquisição de veículos");
    expect(requestedUrl.searchParams.get("$select")).toContain("cnpj8");
  });
});
