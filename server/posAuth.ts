import { TRPCError } from "@trpc/server";
import type { StaffRole } from "./authTokens";
import { verifyMemberAccessToken, verifyStaffAccessToken } from "./authTokens";
import { appendAuditLog, getLoyaltyMemberById, getStaffById } from "./db";
import { publicProcedure } from "./_core/trpc";

function bearerToken(value: string | undefined): string | null {
  if (!value?.startsWith("Bearer ")) return null;
  const token = value.slice("Bearer ".length).trim();
  return token || null;
}

export const staffProcedure = publicProcedure.use(async ({ ctx, next }) => {
  const token = bearerToken(ctx.req.headers.authorization);
  if (!token) {
    void appendAuditLog({ action: "authorization.denied", entityType: "staff", metadata: { policy: "staff_token_missing" } });
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Staff access token is required" });
  }

  let activeAccountDenied = false;
  try {
    const tokenPayload = await verifyStaffAccessToken(token);
    const currentStaff = await getStaffById(tokenPayload.userId);
    if (!currentStaff || !currentStaff.isActive || currentStaff.role === "user") {
      void appendAuditLog({ userId: tokenPayload.userId, action: "authorization.denied", entityType: "staff", entityId: tokenPayload.userId, metadata: { policy: "staff_account_active" } });
      activeAccountDenied = true;
      throw new Error("Staff account is unavailable");
    }
    const staff = { userId: currentStaff.id, role: currentStaff.role as StaffRole, kind: "staff" as const };
    return next({ ctx: { ...ctx, staff } });
  } catch {
    if (!activeAccountDenied) void appendAuditLog({ action: "authorization.denied", entityType: "staff", metadata: { policy: "staff_token_invalid" } });
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Staff access token is invalid, expired, or revoked" });
  }
});

function roleProcedure(allowedRoles: readonly StaffRole[]) {
  return staffProcedure.use(async ({ ctx, next }) => {
    if (!allowedRoles.includes(ctx.staff.role)) {
      void appendAuditLog({ userId: ctx.staff.userId, action: "authorization.denied", entityType: "staff", entityId: ctx.staff.userId, metadata: { policy: "staff_role", actualRole: ctx.staff.role, requiredRoles: allowedRoles } });
      throw new TRPCError({ code: "FORBIDDEN", message: "Your staff role cannot perform this action" });
    }
    return next({ ctx });
  });
}

export const managerProcedure = roleProcedure(["manager", "admin"] as const);
export const adminStaffProcedure = roleProcedure(["admin"] as const);

export const memberProcedure = publicProcedure.use(async ({ ctx, next }) => {
  const token = bearerToken(ctx.req.headers.authorization);
  if (!token) {
    void appendAuditLog({ action: "authorization.denied", entityType: "loyalty_member", metadata: { policy: "member_token_missing" } });
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Member access token is required" });
  }

  let activeAccountDenied = false;
  try {
    const member = await verifyMemberAccessToken(token);
    const currentMember = await getLoyaltyMemberById(member.memberId);
    if (!currentMember || currentMember.status !== "active") {
      void appendAuditLog({ action: "authorization.denied", entityType: "loyalty_member", entityId: member.memberId, metadata: { policy: "member_account_active" } });
      activeAccountDenied = true;
      throw new Error("Member account is unavailable");
    }
    return next({ ctx: { ...ctx, member } });
  } catch {
    if (!activeAccountDenied) void appendAuditLog({ action: "authorization.denied", entityType: "loyalty_member", metadata: { policy: "member_token_invalid" } });
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Member access token is invalid or expired" });
  }
});
