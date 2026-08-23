import { centavosToDecimal, decimalToCentavos } from "./checkoutRules";

export function calculatePartialRefund(input: { soldQuantity: string; alreadyReturnedQuantity: string; requestedQuantity: string; lineTotal: string }) {
  const soldQuantity = Number(input.soldQuantity);
  const alreadyReturnedQuantity = Number(input.alreadyReturnedQuantity);
  const requestedQuantity = Number(input.requestedQuantity);
  if (!Number.isFinite(soldQuantity) || !Number.isFinite(alreadyReturnedQuantity) || !Number.isFinite(requestedQuantity) || soldQuantity <= 0 || requestedQuantity <= 0) {
    throw new Error("Return quantities must be positive and valid");
  }
  if (alreadyReturnedQuantity + requestedQuantity > soldQuantity + 0.000001) throw new Error("Requested return quantity exceeds the original sale quantity");
  return centavosToDecimal(Math.round((decimalToCentavos(input.lineTotal) * requestedQuantity) / soldQuantity));
}
