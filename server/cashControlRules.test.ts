import { describe, expect, it } from "vitest";
import { calculateDenominationCount, needsVarianceApproval } from "./cashControlRules";

describe("cash-control rules", () => {
  it("calculates PHP denomination counts without floating-point drift", () => {
    expect(calculateDenominationCount([{ denomination: "1000.00", quantity: 2 }, { denomination: "20.00", quantity: 3 }])).toEqual({
      total: "2060.00",
      entries: [{ denomination: "1000.00", quantity: 2, countedAmount: "2000.00" }, { denomination: "20.00", quantity: 3, countedAmount: "60.00" }],
    });
  });

  it("rejects duplicate or invalid count rows and flags material variance", () => {
    expect(() => calculateDenominationCount([{ denomination: "100.00", quantity: 1 }, { denomination: "100.00", quantity: 2 }])).toThrow("must not be duplicated");
    expect(() => calculateDenominationCount([{ denomination: "20.00", quantity: -1 }])).toThrow("non-negative");
    expect(needsVarianceApproval("100.00")).toBe(true);
    expect(needsVarianceApproval("-99.99")).toBe(false);
  });
});
