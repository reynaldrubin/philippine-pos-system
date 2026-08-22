import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { issueStaffAccessToken } from "./authTokens";

const dbMocks = vi.hoisted(() => ({ getStaffById: vi.fn(), getLoyaltyMemberDetail: vi.fn(), listMemberPurchases: vi.fn(), listMemberPointTransactions: vi.fn() }));
vi.mock("./db", async importOriginal => ({ ...(await importOriginal<typeof import("./db")>()), ...dbMocks }));

import { appRouter } from "./routers";

async function staffCaller() {
  dbMocks.getStaffById.mockResolvedValue({ id: 55, openId: null, name: "Cashier", email: "cashier@example.com", passwordHash: "hash", loginMethod: "password", role: "cashier", isActive: true, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() });
  const token = await issueStaffAccessToken(55, "cashier");
  const ctx: TrpcContext = { user: null, req: { headers: { authorization: `Bearer ${token}` } } as TrpcContext["req"], res: {} as TrpcContext["res"] };
  return appRouter.createCaller(ctx);
}

describe("staff loyalty member activity", () => {
  beforeEach(() => vi.clearAllMocks());
  it("returns contact, membership, balance, card, purchases, and immutable ledger activity for a member lookup", async () => {
    dbMocks.getLoyaltyMemberDetail.mockResolvedValue({ id: 8, memberNumber: "TM-000008", firstName: "Ana", lastName: "Reyes", mobile: "09171234567", email: "ana@example.com", status: "active", joinedAt: new Date("2026-08-01"), currentPoints: 24, lifetimeEarned: 30, lifetimeRedeemed: 6, cardNumber: "CARD-8", displayToken: "loyalty:TM-000008", cardStatus: "active" });
    dbMocks.listMemberPurchases.mockResolvedValue([{ id: 81, receiptNumber: "R-000081", memberId: 8, totalAmount: "1200.00", pointsEarned: 12, createdAt: new Date("2026-08-21") }]);
    dbMocks.listMemberPointTransactions.mockResolvedValue([{ id: 91, memberId: 8, type: "earn", points: 12, balanceAfter: 24, createdAt: new Date("2026-08-21") }]);
    const caller = await staffCaller();
    await expect(caller.loyalty.detail({ memberId: 8 })).resolves.toMatchObject({ mobile: "09171234567", status: "active", lifetimeEarned: 30, cardStatus: "active" });
    await expect(caller.loyalty.purchases({ memberId: 8 })).resolves.toEqual(expect.arrayContaining([expect.objectContaining({ receiptNumber: "R-000081", pointsEarned: 12 })]));
    await expect(caller.loyalty.pointTransactions({ memberId: 8 })).resolves.toEqual(expect.arrayContaining([expect.objectContaining({ type: "earn", balanceAfter: 24 })]));
    expect(dbMocks.listMemberPurchases).toHaveBeenCalledWith(8);
    expect(dbMocks.listMemberPointTransactions).toHaveBeenCalledWith(8);
  });
});
