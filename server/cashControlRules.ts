import { centavosToDecimal, decimalToCentavos } from "./checkoutRules";

export type DenominationCount = { denomination: string; quantity: number };

export function calculateDenominationCount(entries: DenominationCount[]) {
  if (!entries.length) throw new Error("At least one denomination count is required");
  const seen = new Set<string>();
  const total = entries.reduce((sum, entry) => {
    const denomination = decimalToCentavos(entry.denomination);
    if (denomination <= 0 || !Number.isInteger(entry.quantity) || entry.quantity < 0) throw new Error("Cash denominations require a positive amount and non-negative whole quantity");
    if (seen.has(entry.denomination)) throw new Error("Cash denominations must not be duplicated");
    seen.add(entry.denomination);
    return sum + denomination * entry.quantity;
  }, 0);
  return { total: centavosToDecimal(total), entries: entries.map(entry => ({ ...entry, countedAmount: centavosToDecimal(decimalToCentavos(entry.denomination) * entry.quantity) })) };
}

export function needsVarianceApproval(variance: string, approvalThreshold = "100.00") {
  const normalizedVariance = variance.trim();
  const absoluteVariance = normalizedVariance.startsWith("-") ? normalizedVariance.slice(1) : normalizedVariance;
  return decimalToCentavos(absoluteVariance) >= decimalToCentavos(approvalThreshold);
}
