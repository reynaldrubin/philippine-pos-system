import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const dbMocks = vi.hoisted(() => {
  const limits = new Map<string, { channel: "staff" | "member"; keyHash: string; failures: number; windowEndsAt: Date }>();
  const key = (channel: "staff" | "member", keyHash: string) => `${channel}:${keyHash}`;
  return {
    appendAuditLog: vi.fn(),
    clearAuthRateLimit: vi.fn(async (channel: "staff" | "member", keyHash: string) => { limits.delete(key(channel, keyHash)); }),
    getAuthRateLimit: vi.fn(async (channel: "staff" | "member", keyHash: string) => limits.get(key(channel, keyHash))),
    getLoyaltyAccountByMemberId: vi.fn(),
    getLoyaltyMemberByIdentifier: vi.fn(),
    getStaffByEmail: vi.fn(),
    getStaffMenuAccess: vi.fn(),
    listLocationsForUser: vi.fn(),
    registerAuthRateLimitFailure: vi.fn(async (channel: "staff" | "member", keyHash: string, windowEndsAt: Date) => {
      const current = limits.get(key(channel, keyHash));
      limits.set(key(channel, keyHash), { channel, keyHash, failures: (current?.failures ?? 0) + 1, windowEndsAt: current?.windowEndsAt ?? windowEndsAt });
    }),
    reset: () => { limits.clear(); vi.clearAllMocks(); },
  };
});

vi.mock("./db", async importOriginal => ({ ...(await importOriginal<typeof import("./db")>()), ...dbMocks }));

import { appRouter } from "./routers";
import { hashPassword } from "./authTokens";

const ctx = (source: string): TrpcContext => ({ user: null, req: { headers: { "x-forwarded-for": source } } as TrpcContext["req"], res: {} as TrpcContext["res"] });

describe("persistent authentication rate limiting", () => {
  it("throttles repeated failed staff login attempts at the router boundary", async () => {
    dbMocks.reset();
    dbMocks.getStaffByEmail.mockResolvedValue(undefined);
    const caller = appRouter.createCaller(ctx("203.0.113.10"));
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(caller.staffAuth.login({ identifier: "cashier@example.com", password: "IncorrectPass123" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    }
    await expect(caller.staffAuth.login({ identifier: "cashier@example.com", password: "IncorrectPass123" })).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
  });

  it("throttles repeated failed member login attempts independently from staff", async () => {
    dbMocks.reset();
    dbMocks.getLoyaltyMemberByIdentifier.mockResolvedValue(undefined);
    const caller = appRouter.createCaller(ctx("203.0.113.11"));
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(caller.memberAuth.login({ identifier: "09171234567", password: "IncorrectPass123" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    }
    await expect(caller.memberAuth.login({ identifier: "09171234567", password: "IncorrectPass123" })).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
    expect(dbMocks.getStaffByEmail).not.toHaveBeenCalled();
  });

  it("clears stale staff throttle state after a successful sign-in", async () => {
    dbMocks.reset();
    dbMocks.getStaffByEmail.mockResolvedValue(undefined);
    const caller = appRouter.createCaller(ctx("203.0.113.12"));
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await expect(caller.staffAuth.login({ identifier: "manager@example.com", password: "IncorrectPass123" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    }
    dbMocks.getStaffByEmail.mockResolvedValue({ id: 81, name: "Manager", email: "manager@example.com", passwordHash: await hashPassword("ValidPass123"), role: "manager", jobTitle: "Store Manager", isActive: true });
    dbMocks.listLocationsForUser.mockResolvedValue([]);
    dbMocks.getStaffMenuAccess.mockResolvedValue(["overview"]);
    await expect(caller.staffAuth.login({ identifier: "manager@example.com", password: "ValidPass123" })).resolves.toMatchObject({ user: expect.objectContaining({ id: 81 }) });
    dbMocks.getStaffByEmail.mockResolvedValue(undefined);
    await expect(caller.staffAuth.login({ identifier: "manager@example.com", password: "IncorrectPass123" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("clears stale member throttle state after a successful sign-in", async () => {
    dbMocks.reset();
    dbMocks.getLoyaltyMemberByIdentifier.mockResolvedValue(undefined);
    const caller = appRouter.createCaller(ctx("203.0.113.13"));
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await expect(caller.memberAuth.login({ identifier: "09171234568", password: "IncorrectPass123" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    }
    dbMocks.getLoyaltyMemberByIdentifier.mockResolvedValue({ id: 91, memberNumber: "TM-000091", firstName: "Ana", lastName: "Reyes", status: "active", passwordHash: await hashPassword("ValidPass123") });
    dbMocks.getLoyaltyAccountByMemberId.mockResolvedValue({ currentPoints: 7 });
    await expect(caller.memberAuth.login({ identifier: "09171234568", password: "ValidPass123" })).resolves.toMatchObject({ member: expect.objectContaining({ id: 91 }) });
    dbMocks.getLoyaltyMemberByIdentifier.mockResolvedValue(undefined);
    await expect(caller.memberAuth.login({ identifier: "09171234568", password: "IncorrectPass123" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
