export const IOF_FIXED_RATE = 0.0038;
export const IOF_DAILY_RATE = 0.000082;
export const IOF_DAY_CAP = 365;
export const DAYS_PER_INSTALLMENT = 30;
export const MAX_INSTALLMENTS = 84;

export type FinancingResult = {
  principal: number;
  iof: number;
  financedAmount: number;
  installments: number;
  monthlyRate: number;
  payment: number;
  totalPaid: number;
  cetMonthly: number;
};

function ensureNonNegative(value: number, label: string) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} deve ser um número não negativo.`);
  }
}

function ensureInstallments(installments: number) {
  if (!Number.isInteger(installments) || installments < 1) {
    throw new Error("O prazo deve ser um número inteiro maior que zero.");
  }
}

export function calculateIof(principal: number, installments: number) {
  ensureNonNegative(principal, "O principal");
  ensureInstallments(installments);
  const days = Math.min(installments * DAYS_PER_INSTALLMENT, IOF_DAY_CAP);
  return principal * (IOF_FIXED_RATE + IOF_DAILY_RATE * days);
}

export function calculatePricePayment(
  financedAmount: number,
  monthlyRatePercent: number,
  installments: number,
) {
  ensureNonNegative(financedAmount, "O valor financiado");
  ensureNonNegative(monthlyRatePercent, "A taxa mensal");
  ensureInstallments(installments);

  if (financedAmount === 0) return 0;
  const rate = monthlyRatePercent / 100;
  if (rate === 0) return financedAmount / installments;
  const factor = Math.pow(1 + rate, installments);
  return financedAmount * ((rate * factor) / (factor - 1));
}

export function calculateEffectiveMonthlyRate(
  principal: number,
  payment: number,
  installments: number,
) {
  if (principal === 0 || payment === 0) return 0;
  ensureNonNegative(principal, "O principal");
  ensureNonNegative(payment, "A parcela");
  ensureInstallments(installments);

  const presentValue = (rate: number) => {
    if (rate === 0) return payment * installments;
    return payment * ((1 - Math.pow(1 + rate, -installments)) / rate);
  };

  let low = 0;
  let high = 1;
  while (presentValue(high) > principal && high < 100) high *= 2;

  for (let iteration = 0; iteration < 100; iteration += 1) {
    const middle = (low + high) / 2;
    if (presentValue(middle) > principal) low = middle;
    else high = middle;
  }

  return ((low + high) / 2) * 100;
}

export function calculateFinancing(
  principal: number,
  monthlyRate: number,
  installments: number,
): FinancingResult {
  ensureNonNegative(principal, "O principal");
  ensureNonNegative(monthlyRate, "A taxa mensal");
  ensureInstallments(installments);

  const iof = calculateIof(principal, installments);
  const financedAmount = principal + iof;
  const payment = calculatePricePayment(financedAmount, monthlyRate, installments);
  const totalPaid = payment * installments;

  return {
    principal,
    iof,
    financedAmount,
    installments,
    monthlyRate,
    payment,
    totalPaid,
    cetMonthly: calculateEffectiveMonthlyRate(principal, payment, installments),
  };
}

export function calculateInstallmentsForTargetPayment(
  principal: number,
  monthlyRate: number,
  targetPayment: number,
  maxInstallments = MAX_INSTALLMENTS,
) {
  ensureNonNegative(targetPayment, "A parcela alvo");
  ensureInstallments(maxInstallments);

  for (let installments = 1; installments <= maxInstallments; installments += 1) {
    const result = calculateFinancing(principal, monthlyRate, installments);
    if (result.payment <= targetPayment) return result;
  }

  return null;
}
