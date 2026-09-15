import { describe, expect, it } from "vitest";
import {
  allocateProportionalDiscount,
  calculateCheckoutLoyalty,
  calculateLineAmounts,
  calculateMockPayment,
  centavosToDecimal,
  decimalToCentavos,
  millisToQuantity,
  quantityToMillis,
  requiresPaymentReference,
  taxRateToBasisPoints,
} from "./checkoutRules";

describe("PHP checkout rules", () => {
  it("calculates tax-exclusive and tax-inclusive line totals in centavos", () => {
    expect(calculateLineAmounts({ unitPriceCentavos: 10000, quantityMillis: 1000, taxBasisPoints: 1200, isTaxInclusive: false }))
      .toEqual({ netCentavos: 10000, taxCentavos: 1200, totalCentavos: 11200 });
    expect(calculateLineAmounts({ unitPriceCentavos: 11200, quantityMillis: 1000, taxBasisPoints: 1200, isTaxInclusive: true }))
      .toEqual({ netCentavos: 10000, taxCentavos: 1200, totalCentavos: 11200 });
  });

  it("formats PHP values and three-decimal quantities without floating-point arithmetic", () => {
    expect(decimalToCentavos("1250.50")).toBe(125050);
    expect(centavosToDecimal(125050)).toBe("1250.50");
    expect(quantityToMillis("2.375")).toBe(2375);
    expect(millisToQuantity(2375)).toBe("2.375");
    expect(taxRateToBasisPoints("0.12")).toBe(1200);
  });

  it("handles cash change and awardable loyalty points only after qualifying spend", () => {
    expect(calculateMockPayment({ method: "cash", totalCentavos: 11200, tenderedCentavos: 15000 }))
      .toEqual({ status: "paid", amountTenderedCentavos: 15000, changeCentavos: 3800 });
    expect(calculateMockPayment({ method: "gcash", totalCentavos: 11200 }))
      .toEqual({ status: "paid", amountTenderedCentavos: 11200, changeCentavos: 0 });
    expect(calculateMockPayment({ method: "maya", totalCentavos: 11200, outcome: "failed" }))
      .toEqual({ status: "failed", amountTenderedCentavos: 0, changeCentavos: 0 });
    expect(calculateCheckoutLoyalty(9999)).toBe(0);
    expect(calculateCheckoutLoyalty(27800)).toBe(2);
  });

  it("requires a transaction reference for non-cash Philippine payment methods", () => {
    expect(requiresPaymentReference("cash")).toBe(false);
    expect(requiresPaymentReference("gcash")).toBe(true);
    expect(requiresPaymentReference("maya")).toBe(true);
    expect(requiresPaymentReference("bank_transfer")).toBe(true);
  });

  it("allocates a discount proportionally while preserving the exact PHP total", () => {
    expect(allocateProportionalDiscount([10000, 5000], 1200)).toEqual([800, 400]);
    expect(allocateProportionalDiscount([333, 333, 334], 101)).toEqual([33, 33, 35]);
  });
});
