import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { issueStaffAccessToken } from "./authTokens";

const dbMocks = vi.hoisted(() => ({
  getStaffById: vi.fn(),
  updateCategory: vi.fn(),
  updateProduct: vi.fn(),
}));

vi.mock("./db", async importOriginal => {
  const actual = await importOriginal<typeof import("./db")>();
  return { ...actual, ...dbMocks };
});

import { appRouter } from "./routers";

describe("catalog archive behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.getStaffById.mockResolvedValue({
      id: 31, openId: null, name: "Catalog Manager", email: "catalog@example.com", passwordHash: "hash", loginMethod: "password",
      role: "manager", isActive: true, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
    });
  });

  it("archives categories and products through status updates instead of deletion", async () => {
    const token = await issueStaffAccessToken(31, "manager");
    const ctx: TrpcContext = {
      user: null,
      req: { headers: { authorization: `Bearer ${token}` } } as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);

    await expect(caller.categories.archive({ categoryId: 7 })).resolves.toEqual({ success: true });
    await expect(caller.products.archive({ productId: 15 })).resolves.toEqual({ success: true });
    expect(dbMocks.updateCategory).toHaveBeenCalledWith({ categoryId: 7, isActive: false });
    expect(dbMocks.updateProduct).toHaveBeenCalledWith({ productId: 15, isActive: false });
  });
});
