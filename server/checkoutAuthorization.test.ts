import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { issueStaffAccessToken } from "./authTokens";

const dbMocks = vi.hoisted(() => ({ getStaffById: vi.fn(), hasLocationAccess: vi.fn() }));
const checkoutMocks = vi.hoisted(() => ({ completeCheckout: vi.fn(), getDigitalReceipt: vi.fn(), getSaleAccessInfo: vi.fn(), quoteCheckout: vi.fn(), voidCompletedSale: vi.fn() }));

vi.mock("./db", async importOriginal => ({ ...(await importOriginal<typeof import("./db")>()), ...dbMocks }));
vi.mock("./checkoutService", () => checkoutMocks);

import { appRouter } from "./routers";

function activeStaff(role: "cashier" | "manager") {
  return { id: 44, openId: null, name: "POS Staff", email: "pos@example.com", passwordHash: "hash", loginMethod: "password", role, isActive: true, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() };
}

async function caller(role: "cashier" | "manager") {
  dbMocks.getStaffById.mockResolvedValue(activeStaff(role));
  const token = await issueStaffAccessToken(44, role);
  const ctx: TrpcContext = { user: null, req: { headers: { authorization: `Bearer ${token}` } } as TrpcContext["req"], res: {} as TrpcContext["res"] };
  return appRouter.createCaller(ctx);
}

describe("checkout authorization", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects checkout completion before invoking the transaction service at an unassigned location", async () => {
    dbMocks.hasLocationAccess.mockResolvedValue(false);
    const staffCaller = await caller("cashier");
    await expect(staffCaller.checkout.complete({
      locationId: 98, registerId: 4, cashSessionId: 8, paymentMethod: "cash", amountTendered: "100.00", idempotencyKey: "idem-checkout-0001",
      lines: [{ productId: 9, quantity: "1" }],
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(checkoutMocks.completeCheckout).not.toHaveBeenCalled();
  });

  it("prevents a manager from voiding a sale outside an assigned location", async () => {
    checkoutMocks.getSaleAccessInfo.mockResolvedValue({ id: 81, locationId: 98, status: "completed", receiptNumber: "RCPT-81" });
    dbMocks.hasLocationAccess.mockResolvedValue(false);
    const managerCaller = await caller("manager");
    await expect(managerCaller.checkout.void({ saleId: 81, reason: "Customer requested cancellation" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(checkoutMocks.voidCompletedSale).not.toHaveBeenCalled();
  });

  it("returns the full stored receipt payload, including cashier identity, to authorized staff", async () => {
    dbMocks.hasLocationAccess.mockResolvedValue(true);
    checkoutMocks.getDigitalReceipt.mockResolvedValue({
      saleId: 71, locationId: 3, status: "completed", receiptNumber: "RCPT-TEST-71",
      content: {
        cashier: { id: 44, name: "POS Staff", email: "pos@example.com" },
        totalAmount: "112.00", taxBreakdown: [{ taxRate: "0.12", taxAmount: "12.00" }],
        payment: { method: "gcash", reference: "MOCK-GCASH-71" }, loyalty: { pointsEarned: 1, pointsBalance: 15 },
      },
    });
    const staffCaller = await caller("cashier");
    await expect(staffCaller.checkout.receipt({ receiptNumber: "RCPT-TEST-71" })).resolves.toMatchObject({
      receiptNumber: "RCPT-TEST-71",
      content: {
        cashier: { id: 44, name: "POS Staff" }, totalAmount: "112.00",
        payment: { method: "gcash" }, loyalty: { pointsEarned: 1 },
      },
    });
  });
});
