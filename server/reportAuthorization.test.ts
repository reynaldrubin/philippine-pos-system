import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { issueStaffAccessToken } from "./authTokens";

const dbMocks = vi.hoisted(() => ({ appendAuditLog: vi.fn(), getStaffById: vi.fn(), hasLocationAccess: vi.fn(), getLocationDashboardReport: vi.fn(), getCashSessionReport: vi.fn(), getLoyaltyLocationReport: vi.fn(), listLocationsForUser: vi.fn() }));
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
    expect(dbMocks.appendAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "authorization.denied", userId: 71, locationId: 42, metadata: { policy: "location_assignment", role: "manager" } }));
  });

  it("returns daily revenue and top products for an assigned location", async () => {
    dbMocks.hasLocationAccess.mockResolvedValue(true);
    dbMocks.getLocationDashboardReport.mockResolvedValue({ revenue: "1250.00", transactionCount: 4, topProducts: [{ name: "Coffee", sku: "COF-001", quantity: "5", revenue: "500.00" }] });
    const caller = await managerCaller();
    await expect(caller.reports.locationDashboard({ locationId: 4 })).resolves.toMatchObject({ revenue: "1250.00", transactionCount: 4, topProducts: [{ sku: "COF-001" }] });
  });

  it("does not expose cash or loyalty summaries outside the manager's assigned locations", async () => {
    dbMocks.hasLocationAccess.mockResolvedValue(false);
    const caller = await managerCaller();
    await expect(caller.reports.cashSessions({ locationId: 42 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.reports.loyalty({ locationId: 42 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(dbMocks.getCashSessionReport).not.toHaveBeenCalled();
    expect(dbMocks.getLoyaltyLocationReport).not.toHaveBeenCalled();
  });

  it("limits a manager comparison to locations assigned to that manager", async () => {
    dbMocks.listLocationsForUser.mockResolvedValue([{ id: 4, code: "MNL-01", name: "Manila Store", type: "store", isPrimary: true }]);
    dbMocks.getLocationDashboardReport.mockResolvedValue({ revenue: "900.00", transactionCount: 3, topProducts: [] });
    const caller = await managerCaller();
    await expect(caller.reports.locationComparison()).resolves.toEqual([{ location: expect.objectContaining({ id: 4 }), revenue: "900.00", transactionCount: 3, topProducts: [] }]);
    expect(dbMocks.getLocationDashboardReport).toHaveBeenCalledWith(4);
  });
});
