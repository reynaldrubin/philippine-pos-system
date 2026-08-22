import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, publicProcedure, router } from "./_core/trpc";
import { hashPassword, issueMemberAccessToken, issueStaffAccessToken, verifyPassword } from "./authTokens";
import { completeCheckout, getDigitalReceipt, getSaleAccessInfo, quoteCheckout, voidCompletedSale } from "./checkoutService";
import {
  adjustLocationInventory,
  assignUserToLocation,
  cancelStockTransfer,
  closeCashSession,
  createCategory,
  createLoyaltyMember,
  createLocation,
  createProduct,
  createRegister,
  createStaffAccount,
  createStockTransfer,
  getCashSessionWithRegister,
  getCategory,
  getLoyaltyAccountByMemberId,
  getLoyaltyMemberById,
  getLoyaltyMemberByIdentifier,
  getLoyaltyMemberDetail,
  getLocationDashboardReport,
  lookupLoyaltyMemberForStaff,
  getRegisterAtLocation,
  getProduct,
  getStaffByEmail,
  getStaffById,
  getStaffMenuAccess,
  getStockTransfer,
  hasLocationAccess,
  hasInitializedAdmin,
  listAllLocations,
  listCategories,
  listInventoryForLocation,
  listLocationsForUser,
  listMemberPointTransactions,
  listMemberPurchases,
  listOpenCashSessionsForLocation,
  listLowStockForLocation,
  listProducts,
  listRegistersForLocation,
  listStaffAssignmentsForLocation,
  listStaffAccounts,
  listStockMovements,
  listStockTransfersForLocation,
  openCashSession,
  receiveStockTransfer,
  removeUserFromLocation,
  setStaffMenuAccess,
  setLocationInventorySettings,
  setStaffPasswordAndAdminRole,
  shipStockTransfer,
  updateCategory,
  updateLocation,
  updateStaffAccount,
  updateProduct,
  adjustLoyaltyPoints,
} from "./db";
import { adminStaffProcedure, managerProcedure, memberProcedure, staffProcedure } from "./posAuth";
import { staffMenuKeys, staffRoles } from "../drizzle/schema";
import { defaultJobTitleForRole, roleForJobTitle } from "../shared/retailAccess";

const credentialsSchema = z.object({
  identifier: z.string().trim().min(3).max(320),
  password: z.string().min(8).max(128),
});
const phpAmountSchema = z.string().regex(/^\d+(\.\d{1,2})?$/, "Use a non-negative PHP amount with up to two decimal places");
const quantitySchema = z.string().regex(/^-?\d+(\.\d{1,3})?$/, "Use a quantity with up to three decimal places");
const paymentMethodSchema = z.enum(["cash", "gcash", "maya", "qrph", "debit_card", "credit_card", "bank_transfer"]);
const checkoutLinesSchema = z.array(z.object({ productId: z.number().int().positive(), quantity: z.string().regex(/^\d+(\.\d{1,3})?$/) })).min(1)
  .superRefine((lines, ctx) => {
    const ids = new Set<number>();
    lines.forEach((line, index) => {
      if (ids.has(line.productId)) ctx.addIssue({ code: "custom", path: [index, "productId"], message: "Duplicate cart products must be combined" });
      ids.add(line.productId);
    });
  });

function staffProfile(user: NonNullable<Awaited<ReturnType<typeof getStaffById>>>) {
  return { id: user.id, name: user.name, email: user.email, role: user.role, jobTitle: user.jobTitle, isActive: user.isActive };
}

export const appRouter = router({
  system: systemRouter,
  reports: router({
    locationDashboard: managerProcedure.input(z.object({ locationId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        if (!(await hasLocationAccess(ctx.staff.userId, ctx.staff.role, input.locationId))) throw new TRPCError({ code: "FORBIDDEN", message: "You are not assigned to this location" });
        return getLocationDashboardReport(input.locationId);
      }),
  }),
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  staffAuth: router({
    login: publicProcedure.input(credentialsSchema).mutation(async ({ input }) => {
      const staff = await getStaffByEmail(input.identifier);
      if (!staff || staff.role === "user" || !staff.isActive || !staff.passwordHash || !(await verifyPassword(input.password, staff.passwordHash))) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password" });
      }
      const locations = await listLocationsForUser(staff.id);
      const accessToken = await issueStaffAccessToken(staff.id, staff.role);
      return { accessToken, user: staffProfile(staff), locations, menuKeys: await getStaffMenuAccess(staff.id, staff.role) };
    }),
    me: staffProcedure.query(async ({ ctx }) => {
      const staff = await getStaffById(ctx.staff.userId);
      if (!staff || !staff.isActive || staff.role === "user") throw new TRPCError({ code: "UNAUTHORIZED", message: "Staff account is unavailable" });
      return { user: staffProfile(staff), locations: await listLocationsForUser(staff.id), menuKeys: await getStaffMenuAccess(staff.id, staff.role) };
    }),
  }),
  memberAuth: router({
    login: publicProcedure.input(credentialsSchema).mutation(async ({ input }) => {
      const member = await getLoyaltyMemberByIdentifier(input.identifier);
      if (!member || member.status !== "active" || !(await verifyPassword(input.password, member.passwordHash))) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid member credentials" });
      }
      const account = await getLoyaltyAccountByMemberId(member.id);
      return {
        accessToken: await issueMemberAccessToken(member.id),
        member: { id: member.id, memberNumber: member.memberNumber, firstName: member.firstName, lastName: member.lastName },
        points: account?.currentPoints ?? 0,
      };
    }),
    me: memberProcedure.query(async ({ ctx }) => {
      const member = await getLoyaltyMemberById(ctx.member.memberId);
      if (!member || member.status !== "active") throw new TRPCError({ code: "UNAUTHORIZED", message: "Member account is unavailable" });
      const account = await getLoyaltyAccountByMemberId(member.id);
      return { member, account };
    }),
  }),
  bootstrap: router({
    status: publicProcedure.query(async () => ({ initialized: await hasInitializedAdmin() })),
    establishAdminPassword: adminProcedure
      .input(z.object({ password: z.string().min(12).max(128) }))
      .mutation(async ({ ctx, input }) => {
        const passwordHash = await hashPassword(input.password);
        await setStaffPasswordAndAdminRole(ctx.user.id, passwordHash);
        return { accessToken: await issueStaffAccessToken(ctx.user.id, "admin") };
      }),
  }),
  staff: router({
    list: adminStaffProcedure.query(() => listStaffAccounts()),
    create: adminStaffProcedure
      .input(z.object({ name: z.string().trim().min(2).max(160), email: z.string().email(), password: z.string().min(12).max(128), role: z.enum(staffRoles), jobTitle: z.string().trim().min(3).max(100).optional() }))
      .mutation(async ({ input }) => {
        const jobTitle = input.jobTitle || defaultJobTitleForRole(input.role);
        if (roleForJobTitle(jobTitle) !== input.role) throw new TRPCError({ code: "BAD_REQUEST", message: "The Philippine retail job title does not match the selected access role" });
        const passwordHash = await hashPassword(input.password);
        return { userId: await createStaffAccount({ ...input, jobTitle, passwordHash }) };
      }),
    update: adminStaffProcedure
      .input(z.object({ userId: z.number().int().positive(), name: z.string().trim().min(2).max(160).optional(), email: z.string().email().optional(), role: z.enum(staffRoles).optional(), jobTitle: z.string().trim().min(3).max(100).optional(), isActive: z.boolean().optional() }))
      .mutation(async ({ input }) => {
        const current = await getStaffById(input.userId);
        if (!current || current.role === "user") throw new TRPCError({ code: "NOT_FOUND", message: "Staff account was not found" });
        const role = input.role ?? current.role;
        const jobTitle = input.jobTitle ?? current.jobTitle ?? defaultJobTitleForRole(role);
        if (roleForJobTitle(jobTitle) !== role) throw new TRPCError({ code: "BAD_REQUEST", message: "The Philippine retail job title does not match the selected access role" });
        await updateStaffAccount({ ...input, role, jobTitle });
        return { success: true };
      }),
    assignLocation: adminStaffProcedure
      .input(z.object({ userId: z.number().int().positive(), locationId: z.number().int().positive(), isPrimary: z.boolean().optional() }))
      .mutation(async ({ input }) => {
        await assignUserToLocation(input.userId, input.locationId, input.isPrimary ?? false);
        return { success: true };
      }),
    unassignLocation: adminStaffProcedure
      .input(z.object({ userId: z.number().int().positive(), locationId: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        await removeUserFromLocation(input.userId, input.locationId);
        return { success: true };
      }),
    locations: adminStaffProcedure.input(z.object({ userId: z.number().int().positive() })).query(({ input }) => listLocationsForUser(input.userId)),
    menuAccess: adminStaffProcedure.input(z.object({ userId: z.number().int().positive() })).query(async ({ input }) => {
      const staff = await getStaffById(input.userId);
      if (!staff || staff.role === "user") throw new TRPCError({ code: "NOT_FOUND", message: "Staff account was not found" });
      return { menuKeys: await getStaffMenuAccess(staff.id, staff.role) };
    }),
    assignMenus: adminStaffProcedure.input(z.object({ userId: z.number().int().positive(), menuKeys: z.array(z.enum(staffMenuKeys)).max(staffMenuKeys.length) }))
      .mutation(async ({ input }) => {
        const staff = await getStaffById(input.userId);
        if (!staff || staff.role === "user") throw new TRPCError({ code: "NOT_FOUND", message: "Staff account was not found" });
        await setStaffMenuAccess(input.userId, input.menuKeys);
        return { success: true };
      }),
  }),
  locations: router({
    mine: staffProcedure.query(({ ctx }) => listLocationsForUser(ctx.staff.userId)),
    list: staffProcedure.query(async ({ ctx }) => {
      if (ctx.staff.role !== "admin") return listLocationsForUser(ctx.staff.userId);
      const allLocations = await listAllLocations();
      return allLocations.map(location => ({
        id: location.id, code: location.code, name: location.name, type: location.type, isPrimary: false,
      }));
    }),
    create: adminStaffProcedure
      .input(z.object({ code: z.string().trim().min(2).max(32), name: z.string().trim().min(2).max(160), type: z.enum(["store", "branch", "warehouse", "kiosk"]), address: z.string().max(1000).optional(), city: z.string().max(120).optional(), province: z.string().max(120).optional(), postalCode: z.string().max(20).optional(), phone: z.string().max(40).optional() }))
      .mutation(async ({ input }) => ({ locationId: await createLocation(input) })),
    update: adminStaffProcedure
      .input(z.object({ locationId: z.number().int().positive(), code: z.string().trim().min(2).max(32).optional(), name: z.string().trim().min(2).max(160).optional(), type: z.enum(["store", "branch", "warehouse", "kiosk"]).optional(), address: z.string().max(1000).optional(), city: z.string().max(120).optional(), province: z.string().max(120).optional(), postalCode: z.string().max(20).optional(), phone: z.string().max(40).optional(), isActive: z.boolean().optional() }))
      .mutation(async ({ input }) => {
        await updateLocation(input);
        return { success: true };
      }),
    assignments: adminStaffProcedure
      .input(z.object({ locationId: z.number().int().positive() }))
      .query(({ input }) => listStaffAssignmentsForLocation(input.locationId)),
    registers: staffProcedure
      .input(z.object({ locationId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        if (!(await hasLocationAccess(ctx.staff.userId, ctx.staff.role, input.locationId))) throw new TRPCError({ code: "FORBIDDEN", message: "You are not assigned to this location" });
        return listRegistersForLocation(input.locationId);
      }),
    createRegister: managerProcedure
      .input(z.object({ locationId: z.number().int().positive(), code: z.string().trim().min(2).max(40), name: z.string().trim().min(2).max(120) }))
      .mutation(async ({ ctx, input }) => {
        if (!(await hasLocationAccess(ctx.staff.userId, ctx.staff.role, input.locationId))) throw new TRPCError({ code: "FORBIDDEN", message: "You are not assigned to this location" });
        return { registerId: await createRegister(input) };
      }),
  }),
  cashSessions: router({
    list: staffProcedure.input(z.object({ locationId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        if (!(await hasLocationAccess(ctx.staff.userId, ctx.staff.role, input.locationId))) throw new TRPCError({ code: "FORBIDDEN", message: "You are not assigned to this location" });
        return listOpenCashSessionsForLocation(input.locationId, ctx.staff.role === "cashier" ? ctx.staff.userId : undefined);
      }),
    open: staffProcedure
      .input(z.object({ locationId: z.number().int().positive(), registerId: z.number().int().positive(), openingCash: z.string().regex(/^\d+(\.\d{1,2})?$/) }))
      .mutation(async ({ ctx, input }) => {
        if (!(await hasLocationAccess(ctx.staff.userId, ctx.staff.role, input.locationId))) throw new TRPCError({ code: "FORBIDDEN", message: "You are not assigned to this location" });
        if (!(await getRegisterAtLocation(input.registerId, input.locationId))) throw new TRPCError({ code: "BAD_REQUEST", message: "Register is not active at the selected location" });
        return { cashSessionId: await openCashSession({ registerId: input.registerId, openedById: ctx.staff.userId, openingCash: input.openingCash }) };
      }),
    close: staffProcedure
      .input(z.object({ cashSessionId: z.number().int().positive(), closingCash: z.string().regex(/^\d+(\.\d{1,2})?$/) }))
      .mutation(async ({ ctx, input }) => {
        const session = await getCashSessionWithRegister(input.cashSessionId);
        if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Cash session was not found" });
        const mayClose = session.openedById === ctx.staff.userId || ctx.staff.role === "manager" || ctx.staff.role === "admin";
        if (!mayClose || !(await hasLocationAccess(ctx.staff.userId, ctx.staff.role, session.locationId))) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You cannot close this cash session" });
        }
        return closeCashSession({ cashSessionId: input.cashSessionId, closedById: ctx.staff.userId, closingCash: input.closingCash });
      }),
  }),
  categories: router({
    list: staffProcedure.query(() => listCategories()),
    get: staffProcedure.input(z.object({ categoryId: z.number().int().positive() })).query(async ({ input }) => {
      const category = await getCategory(input.categoryId);
      if (!category) throw new TRPCError({ code: "NOT_FOUND", message: "Category was not found" });
      return category;
    }),
    create: managerProcedure.input(z.object({ name: z.string().trim().min(2).max(120), description: z.string().max(1000).optional() }))
      .mutation(async ({ input }) => ({ categoryId: await createCategory(input) })),
    update: managerProcedure.input(z.object({ categoryId: z.number().int().positive(), name: z.string().trim().min(2).max(120).optional(), description: z.string().max(1000).optional(), isActive: z.boolean().optional() }))
      .mutation(async ({ input }) => { await updateCategory(input); return { success: true }; }),
    archive: managerProcedure.input(z.object({ categoryId: z.number().int().positive() }))
      .mutation(async ({ input }) => { await updateCategory({ categoryId: input.categoryId, isActive: false }); return { success: true }; }),
  }),
  products: router({
    list: staffProcedure.input(z.object({ search: z.string().trim().max(120).optional() }).optional()).query(({ input }) => listProducts(input?.search)),
    get: staffProcedure.input(z.object({ productId: z.number().int().positive() })).query(async ({ input }) => {
      const product = await getProduct(input.productId);
      if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Product was not found" });
      return product;
    }),
    create: managerProcedure.input(z.object({ sku: z.string().trim().min(2).max(80), name: z.string().trim().min(2).max(180), description: z.string().max(2000).optional(), categoryId: z.number().int().positive().optional(), price: phpAmountSchema, costPrice: phpAmountSchema, taxRate: z.string().regex(/^0(\.\d{1,4})?$|^1(\.0{1,4})?$/), isTaxInclusive: z.boolean() }))
      .mutation(async ({ input }) => ({ productId: await createProduct(input) })),
    update: managerProcedure.input(z.object({ productId: z.number().int().positive(), sku: z.string().trim().min(2).max(80).optional(), name: z.string().trim().min(2).max(180).optional(), description: z.string().max(2000).optional(), categoryId: z.number().int().positive().nullable().optional(), price: phpAmountSchema.optional(), costPrice: phpAmountSchema.optional(), taxRate: z.string().regex(/^0(\.\d{1,4})?$|^1(\.0{1,4})?$/).optional(), isTaxInclusive: z.boolean().optional(), isActive: z.boolean().optional() }))
      .mutation(async ({ input }) => { await updateProduct(input); return { success: true }; }),
    archive: managerProcedure.input(z.object({ productId: z.number().int().positive() }))
      .mutation(async ({ input }) => { await updateProduct({ productId: input.productId, isActive: false }); return { success: true }; }),
  }),
  inventory: router({
    list: staffProcedure.input(z.object({ locationId: z.number().int().positive(), search: z.string().trim().max(120).optional() }))
      .query(async ({ ctx, input }) => {
        if (!(await hasLocationAccess(ctx.staff.userId, ctx.staff.role, input.locationId))) throw new TRPCError({ code: "FORBIDDEN", message: "You are not assigned to this location" });
        return listInventoryForLocation(input.locationId, input.search);
      }),
    lowStock: managerProcedure.input(z.object({ locationId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        if (!(await hasLocationAccess(ctx.staff.userId, ctx.staff.role, input.locationId))) throw new TRPCError({ code: "FORBIDDEN", message: "You are not assigned to this location" });
        return listLowStockForLocation(input.locationId);
      }),
    settings: managerProcedure.input(z.object({ locationId: z.number().int().positive(), productId: z.number().int().positive(), lowStockThreshold: quantitySchema.refine(value => Number(value) >= 0), reorderQuantity: quantitySchema.refine(value => Number(value) >= 0), priceOverride: phpAmountSchema.nullable().optional() }))
      .mutation(async ({ ctx, input }) => {
        if (!(await hasLocationAccess(ctx.staff.userId, ctx.staff.role, input.locationId))) throw new TRPCError({ code: "FORBIDDEN", message: "You are not assigned to this location" });
        await setLocationInventorySettings(input);
        return { success: true };
      }),
    adjust: managerProcedure.input(z.object({ locationId: z.number().int().positive(), productId: z.number().int().positive(), quantityDelta: quantitySchema.refine(value => Number(value) !== 0), reason: z.enum(["receiving", "adjustment"]), note: z.string().trim().max(1000).optional() }))
      .mutation(async ({ ctx, input }) => {
        if (!(await hasLocationAccess(ctx.staff.userId, ctx.staff.role, input.locationId))) throw new TRPCError({ code: "FORBIDDEN", message: "You are not assigned to this location" });
        return { movementId: await adjustLocationInventory({ ...input, createdById: ctx.staff.userId }) };
      }),
    movements: managerProcedure.input(z.object({ locationId: z.number().int().positive(), productId: z.number().int().positive().optional() }))
      .query(async ({ ctx, input }) => {
        if (!(await hasLocationAccess(ctx.staff.userId, ctx.staff.role, input.locationId))) throw new TRPCError({ code: "FORBIDDEN", message: "You are not assigned to this location" });
        return listStockMovements(input.locationId, input.productId);
      }),
  }),
  stockTransfers: router({
    list: managerProcedure.input(z.object({ locationId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        if (!(await hasLocationAccess(ctx.staff.userId, ctx.staff.role, input.locationId))) throw new TRPCError({ code: "FORBIDDEN", message: "You are not assigned to this location" });
        return listStockTransfersForLocation(input.locationId);
      }),
    request: managerProcedure.input(z.object({ sourceLocationId: z.number().int().positive(), destinationLocationId: z.number().int().positive(), note: z.string().trim().max(1000).optional(), items: z.array(z.object({ productId: z.number().int().positive(), quantityRequested: quantitySchema.refine(value => Number(value) > 0) })).min(1) }))
      .mutation(async ({ ctx, input }) => {
        const canUseSource = await hasLocationAccess(ctx.staff.userId, ctx.staff.role, input.sourceLocationId);
        const canUseDestination = await hasLocationAccess(ctx.staff.userId, ctx.staff.role, input.destinationLocationId);
        if (!canUseSource || !canUseDestination) throw new TRPCError({ code: "FORBIDDEN", message: "You must be assigned to both transfer locations" });
        const transferNumber = `TRF-${Date.now()}-${ctx.staff.userId}`;
        return { transferId: await createStockTransfer({ ...input, transferNumber, requestedById: ctx.staff.userId }) };
      }),
    get: managerProcedure.input(z.object({ transferId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const transfer = await getStockTransfer(input.transferId);
        if (!transfer) throw new TRPCError({ code: "NOT_FOUND", message: "Stock transfer was not found" });
        const canAccessSource = await hasLocationAccess(ctx.staff.userId, ctx.staff.role, transfer.sourceLocationId);
        const canAccessDestination = await hasLocationAccess(ctx.staff.userId, ctx.staff.role, transfer.destinationLocationId);
        if (!canAccessSource && !canAccessDestination) throw new TRPCError({ code: "FORBIDDEN", message: "You are not assigned to either transfer location" });
        return transfer;
      }),
    ship: managerProcedure.input(z.object({ transferId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const transfer = await getStockTransfer(input.transferId);
        if (!transfer) throw new TRPCError({ code: "NOT_FOUND", message: "Stock transfer was not found" });
        if (!(await hasLocationAccess(ctx.staff.userId, ctx.staff.role, transfer.sourceLocationId))) throw new TRPCError({ code: "FORBIDDEN", message: "You are not assigned to the source location" });
        await shipStockTransfer(input.transferId, ctx.staff.userId);
        return { success: true };
      }),
    receive: managerProcedure.input(z.object({ transferId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const transfer = await getStockTransfer(input.transferId);
        if (!transfer) throw new TRPCError({ code: "NOT_FOUND", message: "Stock transfer was not found" });
        if (!(await hasLocationAccess(ctx.staff.userId, ctx.staff.role, transfer.destinationLocationId))) throw new TRPCError({ code: "FORBIDDEN", message: "You are not assigned to the destination location" });
        await receiveStockTransfer(input.transferId, ctx.staff.userId);
        return { success: true };
      }),
    cancel: managerProcedure.input(z.object({ transferId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const transfer = await getStockTransfer(input.transferId);
        if (!transfer) throw new TRPCError({ code: "NOT_FOUND", message: "Stock transfer was not found" });
        const canAccessSource = await hasLocationAccess(ctx.staff.userId, ctx.staff.role, transfer.sourceLocationId);
        const canAccessDestination = await hasLocationAccess(ctx.staff.userId, ctx.staff.role, transfer.destinationLocationId);
        if (!canAccessSource && !canAccessDestination) throw new TRPCError({ code: "FORBIDDEN", message: "You are not assigned to this transfer" });
        await cancelStockTransfer(input.transferId);
        return { success: true };
      }),
  }),
  checkout: router({
    quote: staffProcedure.input(z.object({ locationId: z.number().int().positive(), memberId: z.number().int().positive().optional(), discountAmount: phpAmountSchema.optional(), lines: checkoutLinesSchema }))
      .mutation(async ({ ctx, input }) => {
        if (!(await hasLocationAccess(ctx.staff.userId, ctx.staff.role, input.locationId))) throw new TRPCError({ code: "FORBIDDEN", message: "You are not assigned to this location" });
        return quoteCheckout(input);
      }),
    complete: staffProcedure.input(z.object({
      locationId: z.number().int().positive(), registerId: z.number().int().positive(), cashSessionId: z.number().int().positive(),
      memberId: z.number().int().positive().optional(), paymentMethod: paymentMethodSchema, amountTendered: phpAmountSchema.optional(), discountAmount: phpAmountSchema.optional(), mockPaymentOutcome: z.enum(["success", "failed"]).optional(),
      paymentReference: z.string().trim().min(2).max(120).optional(), idempotencyKey: z.string().trim().min(12).max(128), lines: checkoutLinesSchema,
    })).mutation(async ({ ctx, input }) => {
      if (!(await hasLocationAccess(ctx.staff.userId, ctx.staff.role, input.locationId))) throw new TRPCError({ code: "FORBIDDEN", message: "You are not assigned to this location" });
      try {
        return await completeCheckout({ ...input, cashierId: ctx.staff.userId });
      } catch (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Checkout could not be completed" });
      }
    }),
    void: managerProcedure.input(z.object({ saleId: z.number().int().positive(), reason: z.string().trim().min(3).max(500) }))
      .mutation(async ({ ctx, input }) => {
        const sale = await getSaleAccessInfo(input.saleId);
        if (!sale) throw new TRPCError({ code: "NOT_FOUND", message: "Sale was not found" });
        if (!(await hasLocationAccess(ctx.staff.userId, ctx.staff.role, sale.locationId))) throw new TRPCError({ code: "FORBIDDEN", message: "You are not assigned to this sale location" });
        try {
          return await voidCompletedSale({ saleId: input.saleId, voidedById: ctx.staff.userId, reason: input.reason });
        } catch (error) {
          throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Sale could not be voided" });
        }
      }),
    receipt: staffProcedure.input(z.object({ receiptNumber: z.string().trim().min(8).max(48) }))
      .query(async ({ ctx, input }) => {
        const receipt = await getDigitalReceipt(input.receiptNumber);
        if (!receipt) throw new TRPCError({ code: "NOT_FOUND", message: "Receipt was not found" });
        if (!(await hasLocationAccess(ctx.staff.userId, ctx.staff.role, receipt.locationId))) throw new TRPCError({ code: "FORBIDDEN", message: "You are not assigned to this receipt location" });
        return receipt;
      }),
  }),
  loyalty: router({
    lookup: staffProcedure.input(z.object({ identifier: z.string().trim().min(3).max(320) }))
      .query(async ({ input }) => {
        const member = await lookupLoyaltyMemberForStaff(input.identifier);
        if (!member || member.status !== "active") throw new TRPCError({ code: "NOT_FOUND", message: "Active loyalty member was not found" });
        return member;
      }),
    registerMember: staffProcedure
      .input(
        z.object({
          firstName: z.string().trim().min(1).max(100),
          lastName: z.string().trim().min(1).max(100),
          mobile: z.string().trim().min(7).max(32),
          email: z.string().trim().email().max(320).optional(),
          password: z.string().min(8).max(128),
          joinedLocationId: z.number().int().positive().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        if (input.joinedLocationId && !(await hasLocationAccess(ctx.staff.userId, ctx.staff.role, input.joinedLocationId))) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You are not assigned to this location" });
        }
        const passwordHash = await hashPassword(input.password);
        return createLoyaltyMember({ ...input, passwordHash });
      }),
    detail: staffProcedure.input(z.object({ memberId: z.number().int().positive() })).query(({ input }) => getLoyaltyMemberDetail(input.memberId)),
    purchases: staffProcedure.input(z.object({ memberId: z.number().int().positive() })).query(({ input }) => listMemberPurchases(input.memberId)),
    pointTransactions: staffProcedure.input(z.object({ memberId: z.number().int().positive() })).query(({ input }) => listMemberPointTransactions(input.memberId)),
    adjustPoints: managerProcedure.input(z.object({ memberId: z.number().int().positive(), points: z.number().int().refine(value => value !== 0), note: z.string().trim().min(3).max(240) }))
      .mutation(({ ctx, input }) => adjustLoyaltyPoints({ ...input, createdById: ctx.staff.userId })),
    myPortalSummary: memberProcedure.query(async ({ ctx }) => {
      const member = await getLoyaltyMemberById(ctx.member.memberId);
      const account = await getLoyaltyAccountByMemberId(ctx.member.memberId);
      if (!member || !account) throw new TRPCError({ code: "NOT_FOUND", message: "Loyalty account was not found" });
      return { member, account };
    }),
    myPortalPurchases: memberProcedure.query(({ ctx }) => listMemberPurchases(ctx.member.memberId)),
    myPortalPoints: memberProcedure.query(({ ctx }) => listMemberPointTransactions(ctx.member.memberId)),
    myPortalCard: memberProcedure.query(({ ctx }) => getLoyaltyMemberDetail(ctx.member.memberId)),
  }),
});

export type AppRouter = typeof appRouter;
