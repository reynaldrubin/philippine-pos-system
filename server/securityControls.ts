import { createHash } from "node:crypto";
import { clearAuthRateLimit, getAuthRateLimit, registerAuthRateLimitFailure } from "./db";

export type LoginChannel = "staff" | "member";

const MAX_LOGIN_FAILURES = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export function loginRateLimitKey(channel: LoginChannel, identifier: string, requestSource = "unknown") {
  return createHash("sha256").update(`${channel}:${identifier.trim().toLowerCase()}:${requestSource.trim().toLowerCase()}`).digest("hex");
}

export async function assertLoginAllowed(channel: LoginChannel, identifier: string, requestSource = "unknown", now = Date.now()) {
  const current = await getAuthRateLimit(channel, loginRateLimitKey(channel, identifier, requestSource));
  if (current && current.windowEndsAt.getTime() <= now) return { allowed: true as const };
  if (current && current.failures >= MAX_LOGIN_FAILURES) {
    return { allowed: false as const, retryAfterSeconds: Math.max(1, Math.ceil((current.windowEndsAt.getTime() - now) / 1000)) };
  }
  return { allowed: true as const };
}

export async function registerLoginFailure(channel: LoginChannel, identifier: string, requestSource = "unknown", now = Date.now()) {
  const keyHash = loginRateLimitKey(channel, identifier, requestSource);
  const current = await getAuthRateLimit(channel, keyHash);
  const resetAt = current && current.windowEndsAt.getTime() > now ? current.windowEndsAt.getTime() : now + LOGIN_WINDOW_MS;
  await registerAuthRateLimitFailure(channel, keyHash, new Date(resetAt));
  const nextFailures = current && current.windowEndsAt.getTime() > now ? current.failures + 1 : 1;
  return { failuresRemaining: Math.max(0, MAX_LOGIN_FAILURES - nextFailures), retryAfterSeconds: Math.max(1, Math.ceil((resetAt - now) / 1000)) };
}

export async function clearLoginFailures(channel: LoginChannel, identifier: string, requestSource = "unknown") {
  await clearAuthRateLimit(channel, loginRateLimitKey(channel, identifier, requestSource));
}

const sensitiveMetadataKey = /password|token|secret|authorization|email|mobile|phone|tin|card|account/i;

export function sanitizeAuditMetadata(metadata: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!metadata) return undefined;
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (sensitiveMetadataKey.test(key)) {
      sanitized[key] = "[REDACTED]";
      continue;
    }
    if (Array.isArray(value)) sanitized[key] = value.map(item => typeof item === "object" && item ? sanitizeAuditMetadata(item as Record<string, unknown>) : item);
    else if (typeof value === "object" && value) sanitized[key] = sanitizeAuditMetadata(value as Record<string, unknown>);
    else sanitized[key] = value;
  }
  return sanitized;
}
