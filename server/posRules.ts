import { randomBytes } from "node:crypto";
import type { StaffRole } from "./authTokens";

export const PHP_CENTS_PER_POINT = 10_000;

export function calculateLoyaltyPoints(qualifyingAmountCents: number): number {
  if (!Number.isSafeInteger(qualifyingAmountCents) || qualifyingAmountCents < 0) {
    throw new Error("Qualifying amount must be a non-negative integer number of centavos");
  }

  return Math.floor(qualifyingAmountCents / PHP_CENTS_PER_POINT);
}

export function generateMemberNumber(): string {
  const year = new Date().getUTCFullYear();
  const suffix = randomBytes(4).toString("hex").toUpperCase();
  return `LOY-${year}-${suffix}`;
}

export function generateMemberCardToken(): string {
  return `loyalty_${randomBytes(24).toString("base64url")}`;
}

export function canAccessLocation(role: StaffRole, assignedLocationIds: number[], locationId: number): boolean {
  return role === "admin" || assignedLocationIds.includes(locationId);
}

export function canManageLocationAssignments(role: StaffRole): boolean {
  return role === "admin";
}
