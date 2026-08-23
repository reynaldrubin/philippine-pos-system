import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { issueMemberAccessToken } from "./authTokens";

const dbMocks = vi.hoisted(() => ({
  appendAuditLog: vi.fn(),
  getLoyaltyAccountByMemberId: vi.fn(),
  getLoyaltyMemberById: vi.fn(),
  getLoyaltyMemberDetail: vi.fn(),
  listMemberPointTransactions: vi.fn(),
  listMemberPurchases: vi.fn(),
}));
vi.mock("./db", async importOriginal => ({ ...(await importOriginal<typeof import("./db")>()), ...dbMocks }));

import { appRouter } from "./routers";

const member = { id: 29, memberNumber: "TM-000029", firstName: "Maria", lastName: "Santos", status: "active", createdAt: new Date("2026-01-10") };
const account = { id: 1, memberId: 29, currentPoints: 18, lifetimeEarned: 23, lifetimeRedeemed: 5 };
const memberCtx = async (): Promise<TrpcContext> => ({ user: null, req: { headers: { authorization: `Bearer ${await issueMemberAccessToken(29)}` } } as TrpcContext["req"], res: {} as TrpcContext["res"] });
const anonymousCtx: TrpcContext = { user: null, req: { headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] };

describe("member loyalty portal", () => {
  it("rejects portal data when no member token is supplied", async () => {
    await expect(appRouter.createCaller(anonymousCtx).loyalty.myPortalSummary()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(dbMocks.appendAuditLog).toHaveBeenCalledWith({ action: "authorization.denied", entityType: "loyalty_member", metadata: { policy: "member_token_missing" } });
  });

  it("rejects an invalid member token and records no token or member identifier", async () => {
    const invalidCtx: TrpcContext = { user: null, req: { headers: { authorization: "Bearer invalid-member-token" } } as TrpcContext["req"], res: {} as TrpcContext["res"] };
    await expect(appRouter.createCaller(invalidCtx).loyalty.myPortalSummary()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(dbMocks.appendAuditLog).toHaveBeenCalledWith({ action: "authorization.denied", entityType: "loyalty_member", metadata: { policy: "member_token_invalid" } });
  });

  it("rejects a previously issued token when the member is no longer active", async () => {
    dbMocks.getLoyaltyMemberById.mockResolvedValue({ ...member, status: "suspended" });
    await expect(appRouter.createCaller(await memberCtx()).loyalty.myPortalSummary()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(dbMocks.getLoyaltyAccountByMemberId).not.toHaveBeenCalled();
    expect(dbMocks.appendAuditLog).toHaveBeenCalledWith({ action: "authorization.denied", entityType: "loyalty_member", entityId: 29, metadata: { policy: "member_account_active" } });
  });

  it("returns only the authenticated member's loyalty summary, purchases, ledger, and e-card", async () => {
    dbMocks.getLoyaltyMemberById.mockResolvedValue(member);
    dbMocks.getLoyaltyAccountByMemberId.mockResolvedValue(account);
    dbMocks.getLoyaltyMemberDetail.mockResolvedValue({ ...member, ...account, cardNumber: "CARD-29", displayToken: "loyalty:TM-000029", cardStatus: "active" });
    dbMocks.listMemberPurchases.mockResolvedValue([{ id: 80, memberId: 29, receiptNumber: "R-000080", totalAmount: "1200.00", pointsEarned: 12, createdAt: new Date("2026-08-20") }]);
    dbMocks.listMemberPointTransactions.mockResolvedValue([{ id: 91, memberId: 29, type: "earn", points: 12, balanceAfter: 18, createdAt: new Date("2026-08-20") }]);
    const caller = appRouter.createCaller(await memberCtx());
    await expect(caller.loyalty.myPortalSummary()).resolves.toEqual({ member, account });
    await expect(caller.loyalty.myPortalPurchases()).resolves.toEqual(expect.arrayContaining([expect.objectContaining({ memberId: 29, pointsEarned: 12 })]));
    await expect(caller.loyalty.myPortalPoints()).resolves.toEqual(expect.arrayContaining([expect.objectContaining({ memberId: 29, type: "earn" })]));
    await expect(caller.loyalty.myPortalCard()).resolves.toEqual(expect.objectContaining({ memberNumber: "TM-000029", displayToken: "loyalty:TM-000029" }));
    expect(dbMocks.getLoyaltyMemberById).toHaveBeenCalledWith(29);
    expect(dbMocks.listMemberPurchases).toHaveBeenCalledWith(29);
    expect(dbMocks.listMemberPointTransactions).toHaveBeenCalledWith(29);
  });
});
