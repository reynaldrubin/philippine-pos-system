import type { TrpcContext } from "./_core/context";
import { issueStaffAccessToken } from "./authTokens";
import { describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  appendAuditLog: vi.fn(), closeCashSession: vi.fn(), createCashSafeDrop: vi.fn(), getCashSafeDrop: vi.fn(), getCashSessionWithRegister: vi.fn(),
  getStaffById: vi.fn(), hasLocationAccess: vi.fn(), approveCashVariance: vi.fn(), reviewCashSafeDrop: vi.fn(),
}));
vi.mock("./db", async importOriginal => ({ ...(await importOriginal<typeof import("./db")>()), ...dbMocks }));

import { appRouter } from "./routers";

async function callerFor(role: "manager" | "admin") {
  dbMocks.getStaffById.mockResolvedValue({ id: 41, openId: null, name: "Manager", email: "manager@example.com", passwordHash: "hash", loginMethod: "password", role, isActive: true, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() });
  dbMocks.hasLocationAccess.mockResolvedValue(true);
  const token = await issueStaffAccessToken(41, role);
  const ctx: TrpcContext = { user: null, req: { headers: { authorization: `Bearer ${token}` } } as TrpcContext["req"], res: {} as TrpcContext["res"] };
  return appRouter.createCaller(ctx);
}

describe("cash-control procedures", () => {
  it("records a documented safe drop and writes its audit event at an assigned location", async () => {
    dbMocks.createCashSafeDrop.mockResolvedValue(91);
    const caller = await callerFor("manager");
    await expect(caller.cashSessions.createSafeDrop({ cashSessionId: 8, locationId: 3, amount: "500.00", reason: "Move excess till cash to secure storage" })).resolves.toEqual({ safeDropId: 91 });
    expect(dbMocks.createCashSafeDrop).toHaveBeenCalledWith(expect.objectContaining({ cashSessionId: 8, locationId: 3, createdById: 41 }));
    expect(dbMocks.appendAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "cash_safe_drop.created", entityId: 91, locationId: 3 }));
  });

  it("reviews a safe drop and approves a pending material variance only at an assigned location", async () => {
    dbMocks.getCashSafeDrop.mockResolvedValue({ id: 91, locationId: 3, cashSessionId: 8, amount: "500.00", status: "pending" });
    dbMocks.reviewCashSafeDrop.mockResolvedValue({ locationId: 3, status: "approved" });
    dbMocks.getCashSessionWithRegister.mockResolvedValue({ id: 8, locationId: 3, openedById: 9 });
    dbMocks.approveCashVariance.mockResolvedValue({ variance: "125.00" });
    const caller = await callerFor("manager");
    await expect(caller.cashSessions.reviewSafeDrop({ safeDropId: 91, approve: true })).resolves.toEqual({ locationId: 3, status: "approved" });
    await expect(caller.cashSessions.approveVariance({ cashSessionId: 8 })).resolves.toEqual({ variance: "125.00" });
    expect(dbMocks.reviewCashSafeDrop).toHaveBeenCalledWith({ safeDropId: 91, approve: true, approvedById: 41 });
    expect(dbMocks.approveCashVariance).toHaveBeenCalledWith({ cashSessionId: 8, approvedById: 41 });
  });

  it("passes a documented material variance through the controlled close workflow", async () => {
    dbMocks.getCashSessionWithRegister.mockResolvedValue({ id: 8, locationId: 3, openedById: 41 });
    dbMocks.closeCashSession.mockResolvedValue({ variance: "125.00", varianceApprovalStatus: "pending" });
    const caller = await callerFor("manager");
    await expect(caller.cashSessions.close({ cashSessionId: 8, closingCash: "1125.00", varianceReason: "Cash overage reconciled during count" })).resolves.toEqual({ variance: "125.00", varianceApprovalStatus: "pending" });
    expect(dbMocks.closeCashSession).toHaveBeenCalledWith({ cashSessionId: 8, closedById: 41, closingCash: "1125.00", varianceReason: "Cash overage reconciled during count" });
    expect(dbMocks.appendAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "cash_session.closed", metadata: { variance: "125.00", approvalStatus: "pending" } }));
  });
});
