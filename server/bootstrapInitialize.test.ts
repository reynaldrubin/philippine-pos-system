import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { verifyStaffAccessToken } from "./authTokens";

const dbMocks = vi.hoisted(() => ({ setStaffPasswordAndAdminRole: vi.fn(), getStaffById: vi.fn(), listLocationsForUser: vi.fn(), getStaffMenuAccess: vi.fn() }));
vi.mock("./db", async importOriginal => ({ ...(await importOriginal<typeof import("./db")>()), ...dbMocks }));

import { appRouter } from "./routers";

describe("owner bootstrap initialization", () => {
  it("initializes the authenticated owner as Admin and returns a usable staff token", async () => {
    dbMocks.getStaffById.mockResolvedValue({ id: 44, name: "Owner", email: "owner@example.com", passwordHash: "hash", loginMethod: "manus", role: "admin", jobTitle: "Head Office Owner", isActive: true, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() });
    dbMocks.listLocationsForUser.mockResolvedValue([]);
    dbMocks.getStaffMenuAccess.mockResolvedValue(["overview", "users"]);
    const ctx: TrpcContext = {
      user: { id: 44, openId: "owner-44", name: "Owner", email: "owner@example.com", loginMethod: "manus", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
      req: { headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"],
    };
    const result = await appRouter.createCaller(ctx).bootstrap.establishAdminPassword({ password: "OwnerBootstrapPass123" });
    expect(dbMocks.setStaffPasswordAndAdminRole).toHaveBeenCalledWith(44, expect.stringMatching(/^scrypt\$/));
    await expect(verifyStaffAccessToken(result.accessToken)).resolves.toEqual({ userId: 44, role: "admin", kind: "staff" });
    expect(result).toMatchObject({ user: { id: 44, role: "admin", jobTitle: "Head Office Owner" }, locations: [], menuKeys: ["overview", "users"] });
  });
});
