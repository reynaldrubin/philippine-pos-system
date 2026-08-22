import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { issueStaffAccessToken } from "./authTokens";

const dbMocks = vi.hoisted(() => ({ getStaffById: vi.fn(), adjustLoyaltyPoints: vi.fn() }));
vi.mock("./db", async importOriginal => ({ ...(await importOriginal<typeof import("./db")>()), ...dbMocks }));

import { appRouter } from "./routers";

async function caller(role: "cashier" | "manager") {
  dbMocks.getStaffById.mockResolvedValue({ id: 91, openId: null, name: "Staff", email: "staff@example.com", passwordHash: "hash", loginMethod: "password", role, isActive: true, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() });
  const token = await issueStaffAccessToken(91, role);
  const ctx: TrpcContext = { user: null, req: { headers: { authorization: `Bearer ${token}` } } as TrpcContext["req"], res: {} as TrpcContext["res"] };
  return appRouter.createCaller(ctx);
}

describe("manual loyalty adjustment authorization", () => {
  beforeEach(() => vi.clearAllMocks());
  it("rejects cashiers before any ledger adjustment is attempted", async () => {
    const staffCaller = await caller("cashier");
    await expect(staffCaller.loyalty.adjustPoints({ memberId: 7, points: 5, note: "Service recovery" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(dbMocks.adjustLoyaltyPoints).not.toHaveBeenCalled();
  });
  it("allows a manager to append an authorized adjustment through the ledger service", async () => {
    dbMocks.adjustLoyaltyPoints.mockResolvedValue(27);
    const managerCaller = await caller("manager");
    await expect(managerCaller.loyalty.adjustPoints({ memberId: 7, points: -3, note: "Returned item correction" })).resolves.toBe(27);
    expect(dbMocks.adjustLoyaltyPoints).toHaveBeenCalledWith({ memberId: 7, points: -3, note: "Returned item correction", createdById: 91 });
  });
});
