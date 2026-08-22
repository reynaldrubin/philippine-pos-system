import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { issueStaffAccessToken } from "./authTokens";

const dbMocks = vi.hoisted(() => ({ createStaffAccount: vi.fn(), getStaffById: vi.fn(), setStaffMenuAccess: vi.fn(), updateStaffAccount: vi.fn() }));
vi.mock("./db", async importOriginal => ({ ...(await importOriginal<typeof import("./db")>()), ...dbMocks }));

import { appRouter } from "./routers";

function staff(role: "cashier" | "manager" | "admin") {
  return { id: 84, openId: null, name: "Head Office", email: "admin@example.com", passwordHash: "hash", loginMethod: "password", role, jobTitle: "Head Office Owner", isActive: true, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() };
}

async function caller(role: "cashier" | "manager" | "admin") {
  dbMocks.getStaffById.mockResolvedValue(staff(role));
  const token = await issueStaffAccessToken(84, role);
  const ctx: TrpcContext = { user: null, req: { headers: { authorization: `Bearer ${token}` } } as TrpcContext["req"], res: {} as TrpcContext["res"] };
  return appRouter.createCaller(ctx);
}

describe("Philippine retail staff hierarchy", () => {
  beforeEach(() => vi.clearAllMocks());
  it("rejects a staff account whose job title does not match its POS role", async () => {
    const admin = await caller("admin");
    await expect(admin.staff.create({ name: "Mario Cruz", email: "mario@example.com", password: "TemporaryPass123", role: "cashier", jobTitle: "Store Manager" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(dbMocks.createStaffAccount).not.toHaveBeenCalled();
  });
  it("maps a valid Store Manager title to manager access and keeps menu changes Admin-only", async () => {
    dbMocks.createStaffAccount.mockResolvedValue(91);
    const admin = await caller("admin");
    await expect(admin.staff.create({ name: "Maria Cruz", email: "maria@example.com", password: "TemporaryPass123", role: "manager", jobTitle: "Store Manager" })).resolves.toEqual({ userId: 91 });
    expect(dbMocks.createStaffAccount).toHaveBeenCalledWith(expect.objectContaining({ role: "manager", jobTitle: "Store Manager" }));

    await expect(admin.staff.assignMenus({ userId: 91, menuKeys: ["overview", "register"] })).resolves.toEqual({ success: true });
    expect(dbMocks.setStaffMenuAccess).toHaveBeenCalledWith(91, ["overview", "register"]);

    const manager = await caller("manager");
    await expect(manager.staff.assignMenus({ userId: 91, menuKeys: ["users"] })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("persists a valid staff hierarchy edit and rejects a mismatched title update", async () => {
    const admin = await caller("admin");
    await expect(admin.staff.update({ userId: 91, name: "Mira Santos", email: "mira@example.com", role: "manager", jobTitle: "Branch Manager" })).resolves.toEqual({ success: true });
    expect(dbMocks.updateStaffAccount).toHaveBeenCalledWith(expect.objectContaining({ userId: 91, role: "manager", jobTitle: "Branch Manager", name: "Mira Santos" }));
    await expect(admin.staff.update({ userId: 91, role: "manager", jobTitle: "Cashier" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
