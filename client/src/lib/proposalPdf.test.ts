import { describe, expect, it, vi } from "vitest";
import { buildProposalPdf } from "./proposalPdf";

function createDocument() {
  return {
    setFillColor: vi.fn(), setTextColor: vi.fn(), setFont: vi.fn(), setFontSize: vi.fn(), setDrawColor: vi.fn(),
    rect: vi.fn(), line: vi.fn(), roundedRect: vi.fn(), save: vi.fn(),
    text: vi.fn(), splitTextToSize: vi.fn().mockReturnValue(["Aviso de simulação"]),
  };
}

describe("proposta PDF", () => {
  it("inclui cenário, comparativo, aviso e nome de arquivo consistente", () => {
    const document = createDocument();
    const filename = buildProposalPdf(document, {
      title: "Loja Ágil",
      vehicleValue: 75_000,
      downPayment: 20_000,
      principal: 55_000,
      mode: "payment",
      targetPayment: 1_800,
      installments: 48,
      generatedAt: "18/08/2026, 10:00:00",
      results: [{ institutionName: "Santander", calculation: { payment: 1795.58, installments: 47, financedAmount: 56855.15, totalPaid: 84392.03, cetMonthly: 1.94, iof: 1855.15 } }],
    });

    expect(filename).toBe("proposta-loja-gil.pdf");
    expect(document.save).toHaveBeenCalledWith(filename);
    expect(document.text).toHaveBeenCalledWith("Cenário da venda", 16, 48);
    expect(document.text).toHaveBeenCalledWith("Santander", 18, 108);
    expect(document.text).toHaveBeenCalledWith("Aviso importante", 20, 135);
    expect(document.splitTextToSize).toHaveBeenCalledWith(expect.stringContaining("simulação informativa"), 168);
  });
});
