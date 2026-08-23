import { afterEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => {
  const limits = new Map<string, { channel: "staff" | "member"; keyHash: string; failures: number; windowEndsAt: Date }>();
  const key = (channel: "staff" | "member", keyHash: string) => `${channel}:${keyHash}`;
  return {
    clearAuthRateLimit: vi.fn(async (channel: "staff" | "member", keyHash: string) => { limits.delete(key(channel, keyHash)); }),
    getAuthRateLimit: vi.fn(async (channel: "staff" | "member", keyHash: string) => limits.get(key(channel, keyHash))),
    registerAuthRateLimitFailure: vi.fn(async (channel: "staff" | "member", keyHash: string, windowEndsAt: Date) => {
      const current = limits.get(key(channel, keyHash));
      limits.set(key(channel, keyHash), { channel, keyHash, failures: (current?.failures ?? 0) + 1, windowEndsAt: current?.windowEndsAt ?? windowEndsAt });
    }),
    reset: () => limits.clear(),
  };
});

vi.mock("./db", () => dbMocks);

import { assertLoginAllowed, clearLoginFailures, loginRateLimitKey, registerLoginFailure, sanitizeAuditMetadata } from "./securityControls";

describe("security controls", () => {
  afterEach(() => dbMocks.reset());

  it("locks only the affected staff identifier after five persistent failures and clears it after success", async () => {
    const now = 1_000_000;
    for (let index = 0; index < 5; index += 1) await registerLoginFailure("staff", "cashier@example.com", "store-terminal", now);
    await expect(assertLoginAllowed("staff", "cashier@example.com", "store-terminal", now)).resolves.toMatchObject({ allowed: false });
    await expect(assertLoginAllowed("staff", "manager@example.com", "store-terminal", now)).resolves.toEqual({ allowed: true });
    await clearLoginFailures("staff", "cashier@example.com", "store-terminal");
    await expect(assertLoginAllowed("staff", "cashier@example.com", "store-terminal", now)).resolves.toEqual({ allowed: true });
  });

  it("hashes the identifier plus source and keeps member and staff channels isolated", async () => {
    const now = 2_000_000;
    expect(loginRateLimitKey("staff", "09171234567", "source-a")).not.toBe(loginRateLimitKey("staff", "09171234567", "source-b"));
    for (let index = 0; index < 5; index += 1) await registerLoginFailure("member", "09171234567", "source-a", now);
    await expect(assertLoginAllowed("member", "09171234567", "source-a", now)).resolves.toMatchObject({ allowed: false });
    await expect(assertLoginAllowed("staff", "09171234567", "source-a", now)).resolves.toEqual({ allowed: true });
  });

  it("redacts credentials and personal-contact metadata before audit persistence", () => {
    expect(sanitizeAuditMetadata({ email: "member@example.com", password: "secret", action: "login", nested: { mobile: "0917" } }))
      .toEqual({ email: "[REDACTED]", password: "[REDACTED]", action: "login", nested: { mobile: "[REDACTED]" } });
  });
});
