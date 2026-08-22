import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { hashPassword, verifyStaffAccessToken } from "./authTokens";

const dbMocks = vi.hoisted(() => ({ getStaffByEmail: vi.fn(), getStaffMenuAccess: vi.fn(), listLocationsForUser: vi.fn() }));
vi.mock("./db", async importOriginal => ({ ...(await importOriginal<typeof import("./db")>()), ...dbMocks }));

import { appRouter } from "./routers";

describe("post-bootstrap staff login", () => {
  it("issues an Admin staff session after the bootstrap password has been configured", async () => {
    const passwordHash = await hashPassword("OwnerBootstrapPass123");
    dbMocks.getStaffByEmail.mockResolvedValue({ id: 44, openId: "owner-44", name: "Owner", email: "owner@example.com", passwordHash, loginMethod: "password", role: "admin", jobTitle: "Head Office Owner", isActive: true, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() });
    dbMocks.listLocationsForUser.mockResolvedValue([]);
    dbMocks.getStaffMenuAccess.mockResolvedValue(["overview", "register", "users"]);
    const ctx: TrpcContext = { user: null, req: { headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] };
    const session = await appRouter.createCaller(ctx).staffAuth.login({ identifier: "owner@example.com", password: "OwnerBootstrapPass123" });
    await expect(verifyStaffAccessToken(session.accessToken)).resolves.toEqual({ userId: 44, role: "admin", kind: "staff" });
    expect(session.menuKeys).toContain("users");
  });
});
