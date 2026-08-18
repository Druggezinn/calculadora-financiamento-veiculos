import { describe, expect, it } from "vitest";
import {
  calculateFinancing,
  calculateInstallmentsForTargetPayment,
  calculateIof,
  calculatePricePayment,
} from "../shared/finance";

describe("motor financeiro", () => {
  it("aplica IOF adicional, diário e teto de 365 dias", () => {
    expect(calculateIof(10_000, 12)).toBeCloseTo(333.2, 6);
    expect(calculateIof(10_000, 48)).toBeCloseTo(337.3, 6);
  });

  it("calcula a parcela Price e reconcilia o total pago", () => {
    const result = calculateFinancing(50_000, 2, 36);
    expect(result.financedAmount).toBeGreaterThan(result.principal);
    expect(result.payment).toBeCloseTo(
      calculatePricePayment(result.financedAmount, 2, 36),
      10,
    );
    expect(result.totalPaid).toBeCloseTo(result.payment * 36, 10);
    expect(result.cetMonthly).toBeGreaterThan(2);
  });

  it("encontra o primeiro prazo que atende a parcela alvo", () => {
    const result = calculateInstallmentsForTargetPayment(40_000, 2, 1_800, 84);
    expect(result).not.toBeNull();
    expect(result?.payment).toBeLessThanOrEqual(1_800);
    expect(result?.installments).toBeGreaterThan(1);
    const prior = calculateFinancing(40_000, 2, (result?.installments ?? 2) - 1);
    expect(prior.payment).toBeGreaterThan(1_800);
  });
});
