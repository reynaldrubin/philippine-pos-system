import { afterEach, describe, expect, it, vi } from "vitest";
import { accessTokenForRoute, isMemberPortalRoute } from "../client/src/lib/routeAuth";

class MemorySessionStorage {
  private values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("member portal client session", () => {
  it("never sends a staff token to the member portal and keeps staff routes on their own token", () => {
    expect(isMemberPortalRoute("/portal")).toBe(true);
    expect(isMemberPortalRoute("/portal/history")).toBe(true);
    expect(isMemberPortalRoute("/register")).toBe(false);
    expect(accessTokenForRoute("/portal", "member-token", "staff-token")).toBe("member-token");
    expect(accessTokenForRoute("/portal", null, "staff-token")).toBeNull();
    expect(accessTokenForRoute("/register", "member-token", "staff-token")).toBe("staff-token");
  });

  it("persists only the member token for an active session and clears it on logout", async () => {
    const sessionStorage = new MemorySessionStorage();
    vi.stubGlobal("window", {});
    vi.stubGlobal("sessionStorage", sessionStorage);
    const { MEMBER_ACCESS_TOKEN_KEY, useMemberPortalStore } = await import("../client/src/stores/memberPortalStore");
    useMemberPortalStore.getState().setSession({ accessToken: "member-token", member: { id: 9, memberNumber: "TM-9", firstName: "Maria", lastName: "Santos" }, points: 10 });
    expect(sessionStorage.getItem(MEMBER_ACCESS_TOKEN_KEY)).toBe("member-token");
    expect(useMemberPortalStore.getState().member?.memberNumber).toBe("TM-9");
    useMemberPortalStore.getState().clearSession();
    expect(sessionStorage.getItem(MEMBER_ACCESS_TOKEN_KEY)).toBeNull();
    expect(useMemberPortalStore.getState().accessToken).toBeNull();
  });
});
