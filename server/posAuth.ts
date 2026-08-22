import { TRPCError } from "@trpc/server";
import type { StaffRole } from "./authTokens";
import { verifyMemberAccessToken, verifyStaffAccessToken } from "./authTokens";
import { getStaffById } from "./db";
import { publicProcedure } from "./_core/trpc";

function bearerToken(value: string | undefined): string | null {
  if (!value?.startsWith("Bearer ")) return null;
  const token = value.slice("Bearer ".length).trim();
  return token || null;
}

export const staffProcedure = publicProcedure.use(async ({ ctx, next }) => {
  const token = bearerToken(ctx.req.headers.authorization);
  if (!token) throw new TRPCError({ code: "UNAUTHORIZED", message: "Staff access token is required" });

  try {
    const tokenPayload = await verifyStaffAccessToken(token);
    const currentStaff = await getStaffById(tokenPayload.userId);
    if (!currentStaff || !currentStaff.isActive || currentStaff.role === "user") throw new Error("Staff account is unavailable");
    const staff = { userId: currentStaff.id, role: currentStaff.role as StaffRole, kind: "staff" as const };
    return next({ ctx: { ...ctx, staff } });
  } catch {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Staff access token is invalid, expired, or revoked" });
  }
});

function roleProcedure(allowedRoles: readonly StaffRole[]) {
  return staffProcedure.use(async ({ ctx, next }) => {
    if (!allowedRoles.includes(ctx.staff.role)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Your staff role cannot perform this action" });
    }
    return next({ ctx });
  });
}

export const managerProcedure = roleProcedure(["manager", "admin"] as const);
export const adminStaffProcedure = roleProcedure(["admin"] as const);

export const memberProcedure = publicProcedure.use(async ({ ctx, next }) => {
  const token = bearerToken(ctx.req.headers.authorization);
  if (!token) throw new TRPCError({ code: "UNAUTHORIZED", message: "Member access token is required" });

  try {
    const member = await verifyMemberAccessToken(token);
    return next({ ctx: { ...ctx, member } });
  } catch {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Member access token is invalid or expired" });
  }
});
