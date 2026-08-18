import type { FinancingResult } from "@shared/finance";

export type ProposalPdfResult = {
  institutionName: string;
  calculation: FinancingResult;
};

export type ProposalPdfInput = {
  title: string;
  vehicleValue: number;
  downPayment: number;
  principal: number;
  mode: "payment" | "term";
  targetPayment: number;
  installments: number;
  results: ProposalPdfResult[];
  generatedAt?: string;
};

type PdfDocument = {
  setFillColor: (...args: number[]) => void;
  rect: (x: number, y: number, width: number, height: number, style: string) => void;
  setTextColor: (...args: number[]) => void;
  setFont: (name: string, style: string) => void;
  setFontSize: (size: number) => void;
  text: (text: string | string[], x: number, y: number) => void;
  setDrawColor: (...args: number[]) => void;
  line: (x1: number, y1: number, x2: number, y2: number) => void;
  roundedRect: (x: number, y: number, width: number, height: number, rx: number, ry: number, style: string) => void;
  splitTextToSize: (text: string, width: number) => string[];
  save: (filename: string) => void;
};

const currencyFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });
const percentageFormatter = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatCurrency = (value: number) => currencyFormatter.format(Number.isFinite(value) ? value : 0);
const formatRate = (value: number) => `${percentageFormatter.format(value)}% a.m.`;

export function buildProposalPdf(document: PdfDocument, input: ProposalPdfInput) {
  const title = input.title || "AutoFin";
  const generatedAt = input.generatedAt ?? new Date().toLocaleString("pt-BR");
  document.setFillColor(18, 59, 58);
  document.rect(0, 0, 210, 34, "F");
  document.setTextColor(255, 250, 240);
  document.setFont("helvetica", "bold");
  document.setFontSize(20);
  document.text(title, 16, 16);
  document.setFontSize(10);
  document.text("Proposta de financiamento — simulação indicativa", 16, 24);
  document.setTextColor(23, 58, 58);
  document.setFontSize(11);
  document.setFont("helvetica", "bold");
  document.text("Cenário da venda", 16, 48);
  document.setFont("helvetica", "normal");
  document.setFontSize(9.5);
  const strategy = input.mode === "payment" ? `Parcela-alvo: ${formatCurrency(input.targetPayment)}` : `Prazo desejado: ${input.installments} meses`;
  [
    `Valor do veículo: ${formatCurrency(input.vehicleValue)}`,
    `Entrada: ${formatCurrency(input.downPayment)}`,
    `Valor financiado: ${formatCurrency(input.principal)}`,
    strategy,
    `Emissão: ${generatedAt}`,
  ].forEach((line, index) => document.text(line, 16, 56 + index * 6));
  document.setFillColor(233, 245, 240);
  document.rect(16, 92, 178, 8, "F");
  document.setFont("helvetica", "bold");
  document.setFontSize(8.5);
  ["FINANCEIRA", "PARCELA", "PRAZO", "TOTAL PAGO", "CET EST."].forEach((heading, index) => document.text(heading, [18, 65, 104, 134, 171][index]!, 97.4));
  document.setFont("helvetica", "normal");
  input.results.slice(0, 10).forEach((result, index) => {
    const y = 108 + index * 8;
    document.text(result.institutionName, 18, y);
    document.text(formatCurrency(result.calculation.payment), 65, y);
    document.text(`${result.calculation.installments}x`, 104, y);
    document.text(formatCurrency(result.calculation.totalPaid), 134, y);
    document.text(formatRate(result.calculation.cetMonthly), 171, y);
    document.setDrawColor(225, 232, 227);
    document.line(16, y + 3, 194, y + 3);
  });
  const noticeY = Math.min(190, 118 + input.results.length * 8);
  document.setFillColor(246, 243, 235);
  document.roundedRect(16, noticeY, 178, 30, 3, 3, "F");
  document.setFont("helvetica", "bold");
  document.setFontSize(9);
  document.text("Aviso importante", 20, noticeY + 9);
  document.setFont("helvetica", "normal");
  document.setFontSize(8.5);
  const notice = document.splitTextToSize(
    "Esta proposta é uma simulação informativa. Taxas, IOF, CET e condições finais dependem da análise da instituição financeira, do perfil do cliente, do veículo e de custos contratuais não cadastrados.",
    168,
  );
  document.text(notice, 20, noticeY + 16);
  const filename = `proposta-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "autofin"}.pdf`;
  document.save(filename);
  return filename;
}

export async function saveProposalPdf(input: ProposalPdfInput) {
  const { jsPDF } = await import("jspdf");
  return buildProposalPdf(new jsPDF({ unit: "mm", format: "a4" }), input);
}
