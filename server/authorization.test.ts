import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { issueStaffAccessToken } from "./authTokens";

const dbMocks = vi.hoisted(() => ({
  appendAuditLog: vi.fn(),
  assignUserToLocation: vi.fn(),
  closeCashSession: vi.fn(),
  createLocation: vi.fn(),
  createLoyaltyMember: vi.fn(),
  createRegister: vi.fn(),
  createStaffAccount: vi.fn(),
  getCashSessionWithRegister: vi.fn(),
  getLoyaltyAccountByMemberId: vi.fn(),
  getLoyaltyMemberById: vi.fn(),
  getLoyaltyMemberByIdentifier: vi.fn(),
  getRegisterAtLocation: vi.fn(),
  getStaffByEmail: vi.fn(),
  getStaffById: vi.fn(),
  hasLocationAccess: vi.fn(),
  listAllLocations: vi.fn(),
  listLocationsForUser: vi.fn(),
  listRegistersForLocation: vi.fn(),
  listStaffAssignmentsForLocation: vi.fn(),
  openCashSession: vi.fn(),
  removeUserFromLocation: vi.fn(),
  setStaffPasswordAndAdminRole: vi.fn(),
  updateLocation: vi.fn(),
}));

vi.mock("./db", () => dbMocks);

import { appRouter } from "./routers";

function staff(role: "cashier" | "manager" | "admin") {
  return {
    id: 12, openId: null, name: "Test Staff", email: "test@example.com", passwordHash: "hash", loginMethod: "password",
    role, isActive: true, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
  };
}

function callerFor(token: string) {
  const ctx: TrpcContext = {
    user: null,
    req: { headers: { authorization: `Bearer ${token}` } } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
  return appRouter.createCaller(ctx);
}

describe("router-level location authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.listLocationsForUser.mockResolvedValue([{ id: 3, code: "MNL-01", name: "Manila Store", type: "store", isPrimary: true }]);
    dbMocks.listAllLocations.mockResolvedValue([{ id: 3, code: "MNL-01", name: "Manila Store", type: "store" }]);
    dbMocks.hasLocationAccess.mockResolvedValue(false);
  });

  it("returns only assigned locations to a manager and blocks unassigned operating actions", async () => {
    dbMocks.getStaffById.mockResolvedValue(staff("manager"));
    const caller = callerFor(await issueStaffAccessToken(12, "manager"));

    await expect(caller.locations.list()).resolves.toEqual([{ id: 3, code: "MNL-01", name: "Manila Store", type: "store", isPrimary: true }]);
    expect(dbMocks.listAllLocations).not.toHaveBeenCalled();

    await expect(caller.locations.registers({ locationId: 99 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.cashSessions.open({ locationId: 99, registerId: 7, openingCash: "1000.00" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.loyalty.registerMember({ firstName: "Ana", lastName: "Santos", mobile: "09171234567", password: "MemberPass123", joinedLocationId: 99 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(dbMocks.createLoyaltyMember).not.toHaveBeenCalled();
    expect(dbMocks.appendAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "authorization.denied", locationId: 99, metadata: { policy: "location_assignment", role: "manager" } }));
  });

  it("audits an unassigned cash-session open attempt with sanitized location policy metadata", async () => {
    dbMocks.getStaffById.mockResolvedValue(staff("manager"));
    const caller = callerFor(await issueStaffAccessToken(12, "manager"));
    await expect(caller.cashSessions.open({ locationId: 99, registerId: 7, openingCash: "1000.00" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(dbMocks.appendAuditLog).toHaveBeenCalledTimes(1);
    expect(dbMocks.appendAuditLog).toHaveBeenCalledWith({ userId: 12, locationId: 99, action: "authorization.denied", entityType: "location", entityId: 99, metadata: { policy: "location_assignment", role: "manager" } });
  });

  it("allows Admin assignment management and rejects the same calls for a manager", async () => {
    dbMocks.getStaffById.mockResolvedValue(staff("manager"));
    const managerCaller = callerFor(await issueStaffAccessToken(12, "manager"));
    await expect(managerCaller.staff.unassignLocation({ userId: 9, locationId: 3 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(managerCaller.locations.update({ locationId: 3, isActive: false })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(managerCaller.locations.assignments({ locationId: 3 })).rejects.toMatchObject({ code: "FORBIDDEN" });

    dbMocks.getStaffById.mockResolvedValue(staff("admin"));
    dbMocks.listStaffAssignmentsForLocation.mockResolvedValue([{ userId: 9, name: "Cashier", email: "cashier@example.com", role: "cashier", isActive: true, isPrimary: true }]);
    const adminCaller = callerFor(await issueStaffAccessToken(12, "admin"));
    await expect(adminCaller.staff.unassignLocation({ userId: 9, locationId: 3 })).resolves.toEqual({ success: true });
    await expect(adminCaller.locations.update({ locationId: 3, isActive: false })).resolves.toEqual({ success: true });
    await expect(adminCaller.locations.assignments({ locationId: 3 })).resolves.toHaveLength(1);
    expect(dbMocks.removeUserFromLocation).toHaveBeenCalledWith(9, 3);
    expect(dbMocks.updateLocation).toHaveBeenCalledWith({ locationId: 3, isActive: false });
  });

  it("rejects an inactive staff account and records only sanitized denial metadata", async () => {
    dbMocks.getStaffById.mockResolvedValue({ ...staff("cashier"), isActive: false });
    const caller = callerFor(await issueStaffAccessToken(12, "cashier"));
    await expect(caller.locations.list()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(dbMocks.appendAuditLog).toHaveBeenCalledWith({ userId: 12, action: "authorization.denied", entityType: "staff", entityId: 12, metadata: { policy: "staff_account_active" } });
  });

  it("rejects an invalid staff token and records no token or identifier", async () => {
    await expect(callerFor("not-a-valid-token").locations.list()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(dbMocks.appendAuditLog).toHaveBeenCalledWith({ action: "authorization.denied", entityType: "staff", metadata: { policy: "staff_token_invalid" } });
  });
});
