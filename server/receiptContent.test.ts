import { describe, expect, it } from "vitest";
import { composeReceiptIdentity } from "./checkoutService";

describe("digital receipt content", () => {
  it("includes store, register, and cashier identity without exposing passwords or session data", () => {
    expect(composeReceiptIdentity({
      location: { code: "MNL-01", name: "Manila Store" },
      register: { code: "POS-02", name: "Counter 2" },
      cashier: { id: 18, name: "Ana Santos", email: "ana@example.com" },
    })).toEqual({
      store: { code: "MNL-01", name: "Manila Store" },
      register: { code: "POS-02", name: "Counter 2" },
      cashier: { id: 18, name: "Ana Santos", email: "ana@example.com" },
    });
  });
});
