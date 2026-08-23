import { describe, expect, it } from "vitest";
import { calculatePartialRefund } from "./returnRules";

describe("partial return refund calculation", () => {
  it("prorates a PHP line total in centavos and caps cumulative returned quantities", () => {
    expect(calculatePartialRefund({ soldQuantity: "3", alreadyReturnedQuantity: "0", requestedQuantity: "1", lineTotal: "299.00" })).toBe("99.67");
    expect(() => calculatePartialRefund({ soldQuantity: "1", alreadyReturnedQuantity: "0.75", requestedQuantity: "0.5", lineTotal: "100.00" })).toThrow("exceeds");
  });
});
