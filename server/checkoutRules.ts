import { calculateLoyaltyPoints } from "./posRules";

export type PaymentMethod = "cash" | "gcash" | "maya" | "qrph" | "debit_card" | "credit_card" | "bank_transfer";

export function decimalToCentavos(value: string | number): number {
  const normalized = String(value).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) throw new Error("PHP amounts must be non-negative with up to two decimal places");
  const [whole, fraction = ""] = normalized.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents)) throw new Error("PHP amount is outside the supported range");
  return cents;
}

export function centavosToDecimal(centavos: number): string {
  if (!Number.isSafeInteger(centavos)) throw new Error("Centavo amount must be a safe integer");
  const sign = centavos < 0 ? "-" : "";
  const absolute = Math.abs(centavos);
  return `${sign}${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, "0")}`;
}

export function quantityToMillis(value: string | number): number {
  const normalized = String(value).trim();
  if (!/^\d+(\.\d{1,3})?$/.test(normalized)) throw new Error("Quantity must be positive with up to three decimal places");
  const [whole, fraction = ""] = normalized.split(".");
  const millis = Number(whole) * 1000 + Number(fraction.padEnd(3, "0"));
  if (!Number.isSafeInteger(millis) || millis <= 0) throw new Error("Quantity must be greater than zero");
  return millis;
}

export function millisToQuantity(millis: number): string {
  if (!Number.isSafeInteger(millis) || millis <= 0) throw new Error("Quantity must be a positive millisecond quantity");
  const whole = Math.floor(millis / 1000);
  const fraction = String(millis % 1000).padStart(3, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : String(whole);
}

export function taxRateToBasisPoints(rate: string | number): number {
  const normalized = String(rate).trim();
  if (!/^0(\.\d{1,4})?$|^1(\.0{1,4})?$/.test(normalized)) throw new Error("Tax rate must be between zero and one");
  const [whole, fraction = ""] = normalized.split(".");
  const basisPoints = Number(whole) * 10_000 + Number(fraction.padEnd(4, "0"));
  return basisPoints;
}

export function calculateLineAmounts(input: { unitPriceCentavos: number; quantityMillis: number; taxBasisPoints: number; isTaxInclusive: boolean }) {
  const grossBeforeTaxTreatment = Math.round((input.unitPriceCentavos * input.quantityMillis) / 1000);
  const taxCentavos = input.isTaxInclusive
    ? Math.round((grossBeforeTaxTreatment * input.taxBasisPoints) / (10_000 + input.taxBasisPoints))
    : Math.round((grossBeforeTaxTreatment * input.taxBasisPoints) / 10_000);
  const netCentavos = input.isTaxInclusive ? grossBeforeTaxTreatment - taxCentavos : grossBeforeTaxTreatment;
  return { netCentavos, taxCentavos, totalCentavos: netCentavos + taxCentavos };
}

export function allocateProportionalDiscount(netCentavosByLine: number[], discountCentavos: number): number[] {
  const subtotalCentavos = netCentavosByLine.reduce((total, amount) => total + amount, 0);
  if (discountCentavos < 0 || discountCentavos > subtotalCentavos) throw new Error("Discount cannot exceed the pre-tax merchandise subtotal");
  let remainingDiscount = discountCentavos;
  return netCentavosByLine.map((amount, index) => {
    const allocated = index === netCentavosByLine.length - 1 ? remainingDiscount : Math.floor((discountCentavos * amount) / subtotalCentavos);
    remainingDiscount -= allocated;
    return allocated;
  });
}

export function calculateMockPayment(input: { method: PaymentMethod; totalCentavos: number; tenderedCentavos?: number; outcome?: "success" | "failed" }) {
  if (input.totalCentavos < 0 || !Number.isSafeInteger(input.totalCentavos)) throw new Error("Checkout total is invalid");
  if (input.method !== "cash" && input.outcome === "failed") {
    return { status: "failed" as const, amountTenderedCentavos: 0, changeCentavos: 0 };
  }
  if (input.method !== "cash") {
    return { status: "paid" as const, amountTenderedCentavos: input.totalCentavos, changeCentavos: 0 };
  }
  if (input.tenderedCentavos === undefined || input.tenderedCentavos < input.totalCentavos) {
    throw new Error("Cash tendered must cover the PHP checkout total");
  }
  return { status: "paid" as const, amountTenderedCentavos: input.tenderedCentavos, changeCentavos: input.tenderedCentavos - input.totalCentavos };
}

export function calculateCheckoutLoyalty(qualifyingCentavos: number) {
  return calculateLoyaltyPoints(qualifyingCentavos);
}
