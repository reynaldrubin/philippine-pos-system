import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { jwtVerify, SignJWT } from "jose";
import { staffRoles } from "../drizzle/schema";

const scryptAsync = promisify(scrypt);
const encoder = new TextEncoder();

export type StaffRole = (typeof staffRoles)[number];

export type StaffTokenPayload = {
  userId: number;
  role: StaffRole;
  kind: "staff";
};

export type MemberTokenPayload = {
  memberId: number;
  kind: "member";
};

function getSigningKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is required for token operations");
  return encoder.encode(secret);
}

function isStaffRole(value: unknown): value is StaffRole {
  return typeof value === "string" && (staffRoles as readonly string[]).includes(value);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  return `scrypt$${salt}$${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [algorithm, salt, expectedHex] = storedHash.split("$");
  if (algorithm !== "scrypt" || !salt || !expectedHex) return false;

  const expected = Buffer.from(expectedHex, "hex");
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  return expected.length === derived.length && timingSafeEqual(expected, derived);
}

export async function issueStaffAccessToken(userId: number, role: StaffRole): Promise<string> {
  return new SignJWT({ kind: "staff", role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(userId))
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(getSigningKey());
}

export async function issueMemberAccessToken(memberId: number): Promise<string> {
  return new SignJWT({ kind: "member" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(memberId))
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(getSigningKey());
}

export async function verifyStaffAccessToken(token: string): Promise<StaffTokenPayload> {
  const { payload } = await jwtVerify(token, getSigningKey());
  const userId = Number(payload.sub);
  if (!Number.isInteger(userId) || userId <= 0 || payload.kind !== "staff" || !isStaffRole(payload.role)) {
    throw new Error("Invalid staff token");
  }
  return { userId, role: payload.role, kind: "staff" };
}

export async function verifyMemberAccessToken(token: string): Promise<MemberTokenPayload> {
  const { payload } = await jwtVerify(token, getSigningKey());
  const memberId = Number(payload.sub);
  if (!Number.isInteger(memberId) || memberId <= 0 || payload.kind !== "member") {
    throw new Error("Invalid member token");
  }
  return { memberId, kind: "member" };
}
