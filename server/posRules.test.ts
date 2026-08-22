import { describe, expect, it } from "vitest";
import {
  hashPassword,
  issueMemberAccessToken,
  issueStaffAccessToken,
  verifyMemberAccessToken,
  verifyPassword,
  verifyStaffAccessToken,
} from "./authTokens";
import { calculateLoyaltyPoints, canAccessLocation, canManageLocationAssignments, generateMemberCardToken, generateMemberNumber } from "./posRules";

describe("loyalty calculation", () => {
  it("awards one point for every complete PHP 100 of qualifying spend", () => {
    expect(calculateLoyaltyPoints(0)).toBe(0);
    expect(calculateLoyaltyPoints(9_999)).toBe(0);
    expect(calculateLoyaltyPoints(10_000)).toBe(1);
    expect(calculateLoyaltyPoints(25_075)).toBe(2);
    expect(() => calculateLoyaltyPoints(-1)).toThrow("non-negative");
  });

  it("generates opaque e-card tokens and formatted member numbers", () => {
    expect(generateMemberNumber()).toMatch(/^LOY-\d{4}-[A-F0-9]{8}$/);
    expect(generateMemberCardToken()).toMatch(/^loyalty_[A-Za-z0-9_-]{32}$/);
  });
});

describe("location scope", () => {
  it("permits admins everywhere and limits other roles to assigned locations", () => {
    expect(canAccessLocation("admin", [], 19)).toBe(true);
    expect(canAccessLocation("manager", [3, 9], 3)).toBe(true);
    expect(canAccessLocation("cashier", [3, 9], 7)).toBe(false);
    expect(canAccessLocation("manager", [3, 9], 7)).toBe(false);
    expect(canManageLocationAssignments("admin")).toBe(true);
    expect(canManageLocationAssignments("manager")).toBe(false);
  });
});

describe("password and JWT helpers", () => {
  it("verifies passwords without accepting incorrect credentials", async () => {
    const hash = await hashPassword("LoyaltyPass123!");
    await expect(verifyPassword("LoyaltyPass123!", hash)).resolves.toBe(true);
    await expect(verifyPassword("incorrect-password", hash)).resolves.toBe(false);
  });

  it("issues separate staff and member JWTs", async () => {
    const staffToken = await issueStaffAccessToken(7, "manager");
    const memberToken = await issueMemberAccessToken(24);
    await expect(verifyStaffAccessToken(staffToken)).resolves.toEqual({ userId: 7, role: "manager", kind: "staff" });
    await expect(verifyMemberAccessToken(memberToken)).resolves.toEqual({ memberId: 24, kind: "member" });
  });
});
