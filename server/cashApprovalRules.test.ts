import { describe, expect, it } from "vitest";
import { assertIndependentCashReviewer } from "./db";

describe("independent cash review safeguard", () => {
  it("rejects self-approval for safe drops and material cash variances", () => {
    expect(() => assertIndependentCashReviewer(44, 44, "safe drop")).toThrow("different staff member");
    expect(() => assertIndependentCashReviewer(44, 44, "cash variance")).toThrow("different staff member");
  });

  it("allows a different manager or Admin reviewer", () => {
    expect(() => assertIndependentCashReviewer(44, 55, "cash variance")).not.toThrow();
  });
});
