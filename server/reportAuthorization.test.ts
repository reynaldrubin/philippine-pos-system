import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { issueStaffAccessToken } from "./authTokens";

const dbMocks = vi.hoisted(() => ({ getStaffById: vi.fn(), hasLocationAccess: vi.fn(), getLocationDashboardReport: vi.fn() }));
vi.mock("./db", async importOriginal => ({ ...(await importOriginal<typeof import("./db")>()), ...dbMocks }));

import { appRouter } from "./routers";

async function managerCaller() {
  dbMocks.getStaffById.mockResolvedValue({ id: 71, openId: null, name: "Manager", email: "manager@example.com", passwordHash: "hash", loginMethod: "password", role: "manager", isActive: true, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() });
  const token = await issueStaffAccessToken(71, "manager");
  const ctx: TrpcContext = { user: null, req: { headers: { authorization: `Bearer ${token}` } } as TrpcContext["req"], res: {} as TrpcContext["res"] };
  return appRouter.createCaller(ctx);
}

describe("location dashboard reporting authorization", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects a manager report request outside their assigned location", async () => {
    dbMocks.hasLocationAccess.mockResolvedValue(false);
    const caller = await managerCaller();
    await expect(caller.reports.locationDashboard({ locationId: 42 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(dbMocks.getLocationDashboardReport).not.toHaveBeenCalled();
  });

  it("returns daily revenue and top products for an assigned location", async () => {
    dbMocks.hasLocationAccess.mockResolvedValue(true);
    dbMocks.getLocationDashboardReport.mockResolvedValue({ revenue: "1250.00", transactionCount: 4, topProducts: [{ name: "Coffee", sku: "COF-001", quantity: "5", revenue: "500.00" }] });
    const caller = await managerCaller();
    await expect(caller.reports.locationDashboard({ locationId: 4 })).resolves.toMatchObject({ revenue: "1250.00", transactionCount: 4, topProducts: [{ sku: "COF-001" }] });
  });
});
