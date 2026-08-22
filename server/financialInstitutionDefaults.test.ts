import { describe, expect, it } from "vitest";
import {
  INITIAL_FINANCIAL_INSTITUTIONS,
  INITIAL_RATE_REFERENCE_URL,
} from "./financialInstitutionDefaults";

describe("taxas financeiras iniciais", () => {
  it("configura as seis financeiras da calculadora com identificadores e taxas válidos", () => {
    expect(INITIAL_FINANCIAL_INSTITUTIONS).toHaveLength(6);
    expect(new Set(INITIAL_FINANCIAL_INSTITUTIONS.map(item => item.slug)).size).toBe(6);
    expect(INITIAL_FINANCIAL_INSTITUTIONS.map(item => item.slug)).toEqual([
      "itau",
      "bradesco",
      "bv",
      "santander",
      "pan",
      "honda-financial",
    ]);

    for (const institution of INITIAL_FINANCIAL_INSTITUTIONS) {
      expect(institution.bcbCnpj8).toMatch(/^\d{8}$/);
      expect(institution.monthlyRate).toBeGreaterThan(0);
      expect(institution.annualRate).toBeGreaterThan(institution.monthlyRate);
    }
  });

  it("mantém uma fonte pública de referência para os parâmetros iniciais", () => {
    expect(INITIAL_RATE_REFERENCE_URL).toContain("olinda.bcb.gov.br");
  });
});
