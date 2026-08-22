import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { issueStaffAccessToken } from "./authTokens";

const dbMocks = vi.hoisted(() => ({
  adjustLocationInventory: vi.fn(),
  createStockTransfer: vi.fn(),
  getStaffById: vi.fn(),
  hasLocationAccess: vi.fn(),
  listInventoryForLocation: vi.fn(),
}));

vi.mock("./db", async importOriginal => {
  const actual = await importOriginal<typeof import("./db")>();
  return { ...actual, ...dbMocks };
});

import { appRouter } from "./routers";

function managerUser() {
  return {
    id: 22, openId: null, name: "Inventory Manager", email: "manager@example.com", passwordHash: "hash", loginMethod: "password",
    role: "manager" as const, isActive: true, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
  };
}

async function managerCaller() {
  dbMocks.getStaffById.mockResolvedValue(managerUser());
  const token = await issueStaffAccessToken(22, "manager");
  const ctx: TrpcContext = {
    user: null,
    req: { headers: { authorization: `Bearer ${token}` } } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
  return appRouter.createCaller(ctx);
}

describe("inventory and stock-transfer authorization", () => {
  beforeEach(() => vi.clearAllMocks());

  it("blocks a manager from reading or adjusting inventory at an unassigned location", async () => {
    dbMocks.hasLocationAccess.mockResolvedValue(false);
    const caller = await managerCaller();

    await expect(caller.inventory.list({ locationId: 99 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.inventory.adjust({ locationId: 99, productId: 5, quantityDelta: "3", reason: "receiving" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(dbMocks.listInventoryForLocation).not.toHaveBeenCalled();
    expect(dbMocks.adjustLocationInventory).not.toHaveBeenCalled();
  });

  it("requires a manager to be assigned to both locations before requesting a transfer", async () => {
    dbMocks.hasLocationAccess.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const caller = await managerCaller();

    await expect(caller.stockTransfers.request({
      sourceLocationId: 3, destinationLocationId: 9, items: [{ productId: 5, quantityRequested: "2" }],
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(dbMocks.createStockTransfer).not.toHaveBeenCalled();
  });

  it("records the authenticated manager as the inventory adjustment actor at an assigned location", async () => {
    dbMocks.hasLocationAccess.mockResolvedValue(true);
    dbMocks.adjustLocationInventory.mockResolvedValue(41);
    const caller = await managerCaller();

    await expect(caller.inventory.adjust({ locationId: 3, productId: 5, quantityDelta: "12", reason: "receiving", note: "Morning delivery" })).resolves.toEqual({ movementId: 41 });
    expect(dbMocks.adjustLocationInventory).toHaveBeenCalledWith({
      locationId: 3, productId: 5, quantityDelta: "12", reason: "receiving", note: "Morning delivery", createdById: 22,
    });
  });
});
