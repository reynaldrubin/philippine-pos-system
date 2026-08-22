import { describe, expect, it } from "vitest";
import { DEFAULT_MENU_ACCESS, RETAIL_MENU_KEYS } from "../shared/retailAccess";

describe("default retail menu access", () => {
  it("exposes Reports to managers and Admins but not cashiers", () => {
    expect(DEFAULT_MENU_ACCESS.manager).toContain("reports");
    expect(DEFAULT_MENU_ACCESS.admin).toContain("reports");
    expect(DEFAULT_MENU_ACCESS.cashier).not.toContain("reports");
  });

  it("keeps the full menu key set available to Admins", () => {
    expect(DEFAULT_MENU_ACCESS.admin).toEqual(RETAIL_MENU_KEYS);
  });
});
