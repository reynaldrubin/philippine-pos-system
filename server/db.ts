import { and, desc, eq, gte, like, lte, ne, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  auditLogs,
  authRateLimits,
  businessProfiles,
  cashCountEntries,
  cashMovements,
  cashSafeDrops,
  categories,
  cashSessions,
  employeeCertificates,
  employeeCompensation,
  employeeLeaveRequests,
  employeeProfiles,
  locationInventory,
  loyaltyAccounts,
  loyaltyCards,
  loyaltyMembers,
  loyaltyTransactions,
  locations,
  philippineHolidays,
  fiscalDocuments,
  invoiceSeries,
  products,
  purchaseOrderItems,
  purchaseOrders,
  purchaseRequestItems,
  purchaseRequests,
  payrollItems,
  payrollRuns,
  reportTemplates,
  receiptDevices,
  registers,
  saleItems,
  sales,
  systemSettings,
  stockMovements,
  stockTransferItems,
  stockTransfers,
  staffAttendance,
  timekeepingSchedules,
  timekeepingScheduleRequests,
  staffMenuAssignments,
  taxRegistrations,
  userLocations,
  users,
} from "../drizzle/schema";
import type { StaffRole } from "./authTokens";
import { DEFAULT_MENU_ACCESS, RETAIL_MENU_KEYS, type RetailMenuKey } from "../shared/retailAccess";
import { generateMemberCardToken, generateMemberNumber } from "./posRules";
import { formatFiscalDocumentNumber } from "./fiscalRules";
import { calculateDenominationCount, needsVarianceApproval, type DenominationCount } from "./cashControlRules";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export type AuditLogInput = {
  userId?: number | null;
  locationId?: number | null;
  action: string;
  entityType: string;
  entityId?: string | number | null;
  metadata?: Record<string, unknown>;
};

export async function appendAuditLog(input: AuditLogInput) {
  const db = await getDb();
  if (!db) return;
  try {
    await db.insert(auditLogs).values({
      userId: input.userId ?? null,
      locationId: input.locationId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId == null ? null : String(input.entityId),
      metadata: input.metadata,
    });
  } catch (error) {
    if (!process.env.VITEST && process.env.NODE_ENV !== "test") {
      console.warn("[Audit] Event persistence failed without interrupting the primary workflow", error instanceof Error ? error.message : error);
    }
  }
}

export async function listAuditLogs(input: { locationId?: number; limit?: number } = {}) {
  const db = await getDb();
  if (!db) return [];
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
  const query = db.select().from(auditLogs);
  if (input.locationId) return query.where(eq(auditLogs.locationId, input.locationId)).orderBy(desc(auditLogs.createdAt)).limit(limit);
  return query.orderBy(desc(auditLogs.createdAt)).limit(limit);
}

export async function getAuthRateLimit(channel: "staff" | "member", keyHash: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(authRateLimits).where(and(eq(authRateLimits.channel, channel), eq(authRateLimits.keyHash, keyHash))).limit(1);
  return rows[0];
}

export async function registerAuthRateLimitFailure(channel: "staff" | "member", keyHash: string, windowEndsAt: Date) {
  const db = await getDb();
  if (!db) return;
  await db.insert(authRateLimits).values({ channel, keyHash, failures: 1, windowEndsAt })
    .onDuplicateKeyUpdate({
      set: {
        failures: sql`if(${authRateLimits.windowEndsAt} <= now(), 1, ${authRateLimits.failures} + 1)`,
        windowEndsAt: sql`if(${authRateLimits.windowEndsAt} <= now(), ${windowEndsAt}, ${authRateLimits.windowEndsAt})`,
      },
    });
}

export async function clearAuthRateLimit(channel: "staff" | "member", keyHash: string) {
  const db = await getDb();
  if (!db) return;
  await db.delete(authRateLimits).where(and(eq(authRateLimits.channel, channel), eq(authRateLimits.keyHash, keyHash)));
}

export type BusinessProfileInput = {
  legalName: string;
  tradeName?: string | null;
  tin: string;
  vatStatus: "vat" | "non_vat";
  registeredAddress: string;
  invoiceLabel?: string;
  isActive?: boolean;
};

export async function listBusinessProfiles() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(businessProfiles).orderBy(desc(businessProfiles.isActive), desc(businessProfiles.updatedAt));
}

export async function createBusinessProfile(input: BusinessProfileInput) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  const result = await db.insert(businessProfiles).values({ ...input, tradeName: input.tradeName ?? null, invoiceLabel: input.invoiceLabel ?? "Invoice", isActive: input.isActive ?? true });
  return Number(result[0].insertId);
}

export async function updateBusinessProfile(input: Partial<BusinessProfileInput> & { businessProfileId: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  const { businessProfileId, ...values } = input;
  await db.update(businessProfiles).set(values).where(eq(businessProfiles.id, businessProfileId));
}

export async function listTaxRegistrations(businessProfileId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(taxRegistrations).where(eq(taxRegistrations.businessProfileId, businessProfileId)).orderBy(desc(taxRegistrations.status), desc(taxRegistrations.updatedAt));
}

export async function createTaxRegistration(input: { businessProfileId: number; birRdoCode?: string; certificateNumber?: string; effectiveFrom?: Date; effectiveTo?: Date; status?: "active" | "inactive" }) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  const result = await db.insert(taxRegistrations).values({ ...input, birRdoCode: input.birRdoCode ?? null, certificateNumber: input.certificateNumber ?? null, status: input.status ?? "active" });
  return Number(result[0].insertId);
}

export async function updateTaxRegistration(input: { taxRegistrationId: number; birRdoCode?: string | null; certificateNumber?: string | null; effectiveFrom?: Date | null; effectiveTo?: Date | null; status?: "active" | "inactive" }) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  const { taxRegistrationId, ...values } = input;
  await db.update(taxRegistrations).set(values).where(eq(taxRegistrations.id, taxRegistrationId));
}

export async function listInvoiceSeries(locationId?: number) {
  const db = await getDb();
  if (!db) return [];
  if (locationId) return db.select().from(invoiceSeries).where(eq(invoiceSeries.locationId, locationId)).orderBy(desc(invoiceSeries.isActive), invoiceSeries.code);
  return db.select().from(invoiceSeries).orderBy(desc(invoiceSeries.isActive), invoiceSeries.locationId, invoiceSeries.code);
}

export async function createInvoiceSeries(input: { businessProfileId: number; locationId: number; code: string; prefix: string; nextSequence?: number; numberPadding?: number; isActive?: boolean }) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  const result = await db.insert(invoiceSeries).values({ ...input, nextSequence: input.nextSequence ?? 1, numberPadding: input.numberPadding ?? 8, isActive: input.isActive ?? true });
  return Number(result[0].insertId);
}

export async function updateInvoiceSeries(input: { invoiceSeriesId: number; code?: string; prefix?: string; nextSequence?: number; numberPadding?: number; isActive?: boolean }) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  const { invoiceSeriesId, ...values } = input;
  await db.update(invoiceSeries).set(values).where(eq(invoiceSeries.id, invoiceSeriesId));
}

export async function listReceiptDevices(locationId?: number) {
  const db = await getDb();
  if (!db) return [];
  if (locationId) return db.select().from(receiptDevices).where(eq(receiptDevices.locationId, locationId)).orderBy(desc(receiptDevices.isActive), receiptDevices.code);
  return db.select().from(receiptDevices).orderBy(desc(receiptDevices.isActive), receiptDevices.locationId, receiptDevices.code);
}

export async function createReceiptDevice(input: { locationId: number; invoiceSeriesId: number; code: string; serialNumber?: string; permitNumber?: string; isActive?: boolean }) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  const result = await db.insert(receiptDevices).values({ ...input, serialNumber: input.serialNumber ?? null, permitNumber: input.permitNumber ?? null, isActive: input.isActive ?? true });
  return Number(result[0].insertId);
}

export async function updateReceiptDevice(input: { receiptDeviceId: number; invoiceSeriesId?: number; code?: string; serialNumber?: string | null; permitNumber?: string | null; isActive?: boolean }) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  const { receiptDeviceId, ...values } = input;
  await db.update(receiptDevices).set(values).where(eq(receiptDevices.id, receiptDeviceId));
}

export async function listFiscalDocuments(locationId?: number) {
  const db = await getDb();
  if (!db) return [];
  if (locationId) return db.select().from(fiscalDocuments).where(eq(fiscalDocuments.locationId, locationId)).orderBy(desc(fiscalDocuments.createdAt)).limit(100);
  return db.select().from(fiscalDocuments).orderBy(desc(fiscalDocuments.createdAt)).limit(100);
}

export async function allocateFiscalDocument(input: { invoiceSeriesId: number; saleId?: number; metadata?: Record<string, unknown> }) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  return db.transaction(async tx => {
    const seriesRows = await tx.select().from(invoiceSeries).where(eq(invoiceSeries.id, input.invoiceSeriesId)).limit(1).for("update");
    const series = seriesRows[0];
    if (!series || !series.isActive) throw new Error("Active invoice series was not found");
    const sequenceNumber = series.nextSequence;
    const documentNumber = formatFiscalDocumentNumber(series.prefix, sequenceNumber, series.numberPadding);
    await tx.update(invoiceSeries).set({ nextSequence: sequenceNumber + 1 }).where(eq(invoiceSeries.id, series.id));
    const result = await tx.insert(fiscalDocuments).values({ invoiceSeriesId: series.id, locationId: series.locationId, saleId: input.saleId ?? null, documentNumber, sequenceNumber, metadata: input.metadata });
    return { fiscalDocumentId: Number(result[0].insertId), locationId: series.locationId, documentNumber, sequenceNumber };
  });
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for OAuth upsert");

  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId, lastSignedIn: new Date() };
  const updateSet: Record<string, unknown> = { lastSignedIn: new Date() };

  for (const field of ["name", "email", "loginMethod"] as const) {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  }

  if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getStaffByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.email, email.trim().toLowerCase())).limit(1);
  return result[0];
}

export async function getStaffById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0];
}

export async function hasInitializedAdmin() {
  const db = await getDb();
  if (!db) return false;
  const result = await db.select({ id: users.id }).from(users)
    .where(and(eq(users.role, "admin"), eq(users.isActive, true), sql`${users.passwordHash} is not null`)).limit(1);
  return Boolean(result[0]);
}

export async function listStaffAccounts() {
  const db = await getDb();
  if (!db) return [];
  return db.select({ id: users.id, name: users.name, email: users.email, role: users.role, jobTitle: users.jobTitle, isActive: users.isActive, createdAt: users.createdAt })
    .from(users).where(ne(users.role, "user"));
}

export async function getLocationDashboardReport(locationId: number) {
  const db = await getDb();
  if (!db) return { revenue: "0.00", transactionCount: 0, topProducts: [] };
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end = new Date(); end.setHours(23, 59, 59, 999);
  const condition = and(eq(sales.locationId, locationId), eq(sales.status, "completed"), gte(sales.createdAt, start), lte(sales.createdAt, end));
  const totals = await db.select({ revenue: sql<string>`coalesce(sum(${sales.totalAmount}), 0)`, transactionCount: sql<number>`count(*)` }).from(sales).where(condition);
  const topProducts = await db.select({ name: saleItems.nameSnapshot, sku: saleItems.skuSnapshot, quantity: sql<string>`coalesce(sum(${saleItems.quantity}), 0)`, revenue: sql<string>`coalesce(sum(${saleItems.lineTotal}), 0)` })
    .from(saleItems).innerJoin(sales, eq(saleItems.saleId, sales.id)).where(condition).groupBy(saleItems.productId, saleItems.nameSnapshot, saleItems.skuSnapshot)
    .orderBy(sql`sum(${saleItems.lineTotal}) desc`).limit(5);
  return { revenue: String(totals[0]?.revenue ?? "0.00"), transactionCount: Number(totals[0]?.transactionCount ?? 0), topProducts };
}

export async function getCashSessionReport(locationId: number) {
  const db = await getDb();
  if (!db) return { openCount: 0, closedCount: 0, totalVariance: "0.00", sessions: [] };
  const sessions = await db.select({
    id: cashSessions.id,
    status: cashSessions.status,
    registerCode: registers.code,
    registerName: registers.name,
    openingCash: cashSessions.openingCash,
    expectedCash: cashSessions.expectedCash,
    closingCash: cashSessions.closingCash,
    variance: cashSessions.variance,
    openedAt: cashSessions.openedAt,
    closedAt: cashSessions.closedAt,
  }).from(cashSessions).innerJoin(registers, eq(cashSessions.registerId, registers.id))
    .where(eq(registers.locationId, locationId)).orderBy(desc(cashSessions.openedAt)).limit(30);
  const openCount = sessions.filter(session => session.status === "open").length;
  const closedCount = sessions.length - openCount;
  const totalVariance = sessions.reduce((sum, session) => sum + Number(session.variance ?? 0), 0).toFixed(2);
  return { openCount, closedCount, totalVariance, sessions };
}

export async function getLoyaltyLocationReport(locationId: number) {
  const db = await getDb();
  if (!db) return { activeMembers: 0, enrolledToday: 0, pointsIssuedToday: 0, pointsReversedToday: 0, adjustmentsToday: 0, topMembers: [] };
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end = new Date(); end.setHours(23, 59, 59, 999);
  const [members] = await db.select({
    activeMembers: sql<number>`coalesce(sum(case when ${loyaltyMembers.status} = 'active' then 1 else 0 end), 0)`,
    enrolledToday: sql<number>`coalesce(sum(case when ${loyaltyMembers.joinedAt} >= ${start} and ${loyaltyMembers.joinedAt} <= ${end} then 1 else 0 end), 0)`,
  }).from(loyaltyMembers).where(eq(loyaltyMembers.joinedLocationId, locationId));
  const [points] = await db.select({
    pointsIssuedToday: sql<number>`coalesce(sum(case when ${loyaltyTransactions.type} = 'earn' then ${loyaltyTransactions.points} else 0 end), 0)`,
    pointsReversedToday: sql<number>`coalesce(sum(case when ${loyaltyTransactions.type} = 'reversal' then abs(${loyaltyTransactions.points}) else 0 end), 0)`,
    adjustmentsToday: sql<number>`coalesce(sum(case when ${loyaltyTransactions.type} = 'adjustment' then 1 else 0 end), 0)`,
  }).from(loyaltyTransactions).where(and(eq(loyaltyTransactions.locationId, locationId), gte(loyaltyTransactions.createdAt, start), lte(loyaltyTransactions.createdAt, end)));
  const topMembers = await db.select({
    memberNumber: loyaltyMembers.memberNumber,
    firstName: loyaltyMembers.firstName,
    lastName: loyaltyMembers.lastName,
    pointsIssued: sql<number>`coalesce(sum(case when ${loyaltyTransactions.type} = 'earn' then ${loyaltyTransactions.points} else 0 end), 0)`,
  }).from(loyaltyTransactions).innerJoin(loyaltyMembers, eq(loyaltyTransactions.memberId, loyaltyMembers.id))
    .where(eq(loyaltyTransactions.locationId, locationId))
    .groupBy(loyaltyMembers.id, loyaltyMembers.memberNumber, loyaltyMembers.firstName, loyaltyMembers.lastName)
    .orderBy(sql`sum(case when ${loyaltyTransactions.type} = 'earn' then ${loyaltyTransactions.points} else 0 end) desc`).limit(5);
  return {
    activeMembers: Number(members?.activeMembers ?? 0),
    enrolledToday: Number(members?.enrolledToday ?? 0),
    pointsIssuedToday: Number(points?.pointsIssuedToday ?? 0),
    pointsReversedToday: Number(points?.pointsReversedToday ?? 0),
    adjustmentsToday: Number(points?.adjustmentsToday ?? 0),
    topMembers: topMembers.map(member => ({ ...member, pointsIssued: Number(member.pointsIssued ?? 0) })),
  };
}

export async function listLocationsForUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: locations.id,
      code: locations.code,
      name: locations.name,
      type: locations.type,
      isPrimary: userLocations.isPrimary,
    })
    .from(userLocations)
    .innerJoin(locations, eq(userLocations.locationId, locations.id))
    .where(eq(userLocations.userId, userId));
}

export async function listAllLocations() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(locations);
}

export async function createLocation(input: {
  code: string;
  name: string;
  type: "store" | "branch" | "warehouse" | "kiosk";
  address?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  phone?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  const [result] = await db.insert(locations).values({
    code: input.code.trim().toUpperCase(), name: input.name.trim(), type: input.type,
    address: input.address?.trim() || null, city: input.city?.trim() || null,
    province: input.province?.trim() || null, postalCode: input.postalCode?.trim() || null, phone: input.phone?.trim() || null,
  });
  return Number(result.insertId);
}

export async function updateLocation(input: {
  locationId: number;
  code?: string;
  name?: string;
  type?: "store" | "branch" | "warehouse" | "kiosk";
  address?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  phone?: string;
  isActive?: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  await db.update(locations).set({
    code: input.code?.trim().toUpperCase(), name: input.name?.trim(), type: input.type,
    address: input.address?.trim(), city: input.city?.trim(), province: input.province?.trim(),
    postalCode: input.postalCode?.trim(), phone: input.phone?.trim(), isActive: input.isActive,
  }).where(eq(locations.id, input.locationId));
}

export async function createStaffAccount(input: { name: string; email: string; passwordHash: string; role: StaffRole; jobTitle?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  const [result] = await db.insert(users).values({
    name: input.name.trim(), email: input.email.trim().toLowerCase(), passwordHash: input.passwordHash, role: input.role, jobTitle: input.jobTitle?.trim() || null, loginMethod: "password",
  });
  return Number(result.insertId);
}

export async function updateStaffAccount(input: { userId: number; name?: string; email?: string; role?: StaffRole; jobTitle?: string; isActive?: boolean }) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  await db.update(users).set({
    name: input.name?.trim(), email: input.email?.trim().toLowerCase(), role: input.role,
    jobTitle: input.jobTitle?.trim(), isActive: input.isActive,
  }).where(eq(users.id, input.userId));
}

export async function getStaffMenuAccess(userId: number, role: StaffRole): Promise<RetailMenuKey[]> {
  const db = await getDb();
  const enabled = new Set<RetailMenuKey>(DEFAULT_MENU_ACCESS[role]);
  if (!db) return Array.from(enabled);
  const rows = await db.select({ menuKey: staffMenuAssignments.menuKey, isEnabled: staffMenuAssignments.isEnabled })
    .from(staffMenuAssignments).where(eq(staffMenuAssignments.userId, userId));
  for (const row of rows) row.isEnabled ? enabled.add(row.menuKey) : enabled.delete(row.menuKey);
  return RETAIL_MENU_KEYS.filter(menuKey => enabled.has(menuKey));
}

export async function setStaffMenuAccess(userId: number, menuKeys: RetailMenuKey[]) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  const selected = new Set(menuKeys);
  await db.transaction(async tx => {
    await tx.delete(staffMenuAssignments).where(eq(staffMenuAssignments.userId, userId));
    await tx.insert(staffMenuAssignments).values(RETAIL_MENU_KEYS.map(menuKey => ({ userId, menuKey, isEnabled: selected.has(menuKey) })));
  });
}

export async function setStaffPasswordAndAdminRole(userId: number, passwordHash: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  await db.update(users).set({ passwordHash, role: "admin", isActive: true, loginMethod: "password" }).where(eq(users.id, userId));
  await db.insert(systemSettings).values([
    { key: "currency", value: "PHP", updatedById: userId },
    { key: "loyalty.earningRule", value: { spendUnitPhp: 100, pointsAwarded: 1, qualifyingBasis: "net_before_tax", rounding: "floor" }, updatedById: userId },
  ]).onDuplicateKeyUpdate({ set: { updatedById: userId } });
}

export const POS_DISPLAY_MODES = ["cafe", "hardware", "grocery", "retail"] as const;
export type PosDisplayMode = (typeof POS_DISPLAY_MODES)[number];

export async function getPosDisplayMode(): Promise<PosDisplayMode> {
  const db = await getDb();
  if (!db) return "retail";
  const row = await db.select({ value: systemSettings.value }).from(systemSettings).where(eq(systemSettings.key, "pos.displayMode")).limit(1);
  const value = row[0]?.value;
  return value && typeof value === "object" && "mode" in value && POS_DISPLAY_MODES.includes((value as { mode?: string }).mode as PosDisplayMode)
    ? (value as { mode: PosDisplayMode }).mode
    : "retail";
}

export async function setPosDisplayMode(mode: PosDisplayMode, updatedById: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  await db.insert(systemSettings).values({ key: "pos.displayMode", value: { mode }, updatedById })
    .onDuplicateKeyUpdate({ set: { value: { mode }, updatedById } });
  return mode;
}

export async function assignUserToLocation(userId: number, locationId: number, isPrimary = false) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  if (isPrimary) await db.update(userLocations).set({ isPrimary: false }).where(eq(userLocations.userId, userId));
  await db.insert(userLocations).values({ userId, locationId, isPrimary }).onDuplicateKeyUpdate({ set: { isPrimary } });
}

export async function removeUserFromLocation(userId: number, locationId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  await db.delete(userLocations).where(and(eq(userLocations.userId, userId), eq(userLocations.locationId, locationId)));
}

export async function listStaffAssignmentsForLocation(locationId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    userId: users.id, name: users.name, email: users.email, role: users.role, jobTitle: users.jobTitle, isActive: users.isActive, isPrimary: userLocations.isPrimary,
  }).from(userLocations).innerJoin(users, eq(userLocations.userId, users.id)).where(eq(userLocations.locationId, locationId));
}

export async function hasLocationAccess(userId: number, role: StaffRole, locationId: number) {
  if (role === "admin") return true;
  const db = await getDb();
  if (!db) return false;
  const result = await db.select({ id: userLocations.id }).from(userLocations)
    .where(and(eq(userLocations.userId, userId), eq(userLocations.locationId, locationId))).limit(1);
  return Boolean(result[0]);
}

export async function createRegister(input: { locationId: number; code: string; name: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  const [result] = await db.insert(registers).values({ locationId: input.locationId, code: input.code.trim().toUpperCase(), name: input.name.trim() });
  return Number(result.insertId);
}

export async function listRegistersForLocation(locationId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(registers).where(eq(registers.locationId, locationId));
}

export async function getRegisterAtLocation(registerId: number, locationId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(registers)
    .where(and(eq(registers.id, registerId), eq(registers.locationId, locationId), eq(registers.isActive, true))).limit(1);
  return result[0];
}

export async function openCashSession(input: { registerId: number; openedById: number; openingCash: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  const active = await db.select({ id: cashSessions.id }).from(cashSessions)
    .where(and(eq(cashSessions.registerId, input.registerId), eq(cashSessions.status, "open"))).limit(1);
  if (active[0]) throw new Error("This register already has an open cash session");
  const [result] = await db.insert(cashSessions).values({
    registerId: input.registerId, openedById: input.openedById, openingCash: input.openingCash, expectedCash: input.openingCash,
  });
  return Number(result.insertId);
}

export async function listOpenCashSessionsForLocation(locationId: number, openedById?: number) {
  const db = await getDb();
  if (!db) return [];
  const filter = openedById
    ? and(eq(registers.locationId, locationId), eq(cashSessions.status, "open"), eq(cashSessions.openedById, openedById))
    : and(eq(registers.locationId, locationId), eq(cashSessions.status, "open"));
  return db.select({
    id: cashSessions.id, registerId: registers.id, registerCode: registers.code, registerName: registers.name,
    openedById: cashSessions.openedById, openingCash: cashSessions.openingCash, expectedCash: cashSessions.expectedCash, openedAt: cashSessions.openedAt,
  }).from(cashSessions).innerJoin(registers, eq(cashSessions.registerId, registers.id)).where(filter);
}

export async function getCashSessionWithRegister(cashSessionId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select({
    id: cashSessions.id, status: cashSessions.status, openedById: cashSessions.openedById,
    expectedCash: cashSessions.expectedCash, registerId: registers.id, locationId: registers.locationId,
  }).from(cashSessions).innerJoin(registers, eq(cashSessions.registerId, registers.id))
    .where(eq(cashSessions.id, cashSessionId)).limit(1);
  return result[0];
}

export async function closeCashSession(input: { cashSessionId: number; closedById: number; closingCash: string; varianceReason?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  const session = await getCashSessionWithRegister(input.cashSessionId);
  if (!session || session.status !== "open") throw new Error("Cash session is not available for closing");
  const countedCash = Number(input.closingCash);
  const expectedCash = Number(session.expectedCash);
  if (!Number.isFinite(countedCash) || countedCash < 0) throw new Error("Counted cash must be a valid non-negative PHP amount");
  const variance = (countedCash - expectedCash).toFixed(2);
  const requiresApproval = needsVarianceApproval(variance);
  if (requiresApproval && !input.varianceReason?.trim()) throw new Error("A variance explanation is required when the cash difference is PHP 100 or more");
  await db.update(cashSessions).set({
    status: "closed", closedById: input.closedById, closingCash: input.closingCash, variance, varianceReason: input.varianceReason?.trim() || null,
    varianceApprovalStatus: requiresApproval ? "pending" : "not_required", closedAt: new Date(),
  }).where(and(eq(cashSessions.id, input.cashSessionId), eq(cashSessions.status, "open")));
  return { expectedCash: expectedCash.toFixed(2), closingCash: countedCash.toFixed(2), variance, varianceApprovalStatus: requiresApproval ? "pending" : "not_required" };
}

export async function upsertCashCountEntries(tx: any, input: { cashSessionId: number; countedById: number; entries: DenominationCount[] }) {
  const count = calculateDenominationCount(input.entries);
  await tx.insert(cashCountEntries).values(count.entries.map(entry => ({ cashSessionId: input.cashSessionId, denomination: entry.denomination, quantity: entry.quantity, countedAmount: entry.countedAmount, countedById: input.countedById }))).onDuplicateKeyUpdate({
    set: { quantity: sql`values(${cashCountEntries.quantity})`, countedAmount: sql`values(${cashCountEntries.countedAmount})`, countedById: sql`values(${cashCountEntries.countedById})` },
  });
  return count;
}

export async function recordCashCount(input: { cashSessionId: number; countedById: number; entries: DenominationCount[] }) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  let count: ReturnType<typeof calculateDenominationCount> | undefined;
  await db.transaction(async tx => {
    const session = await tx.select({ id: cashSessions.id, status: cashSessions.status }).from(cashSessions).where(eq(cashSessions.id, input.cashSessionId)).limit(1).for("update");
    if (!session[0] || session[0].status !== "open") throw new Error("Cash session is not available for a count");
    count = await upsertCashCountEntries(tx, input);
  });
  return count!;
}

export async function createCashSafeDrop(input: { cashSessionId: number; locationId: number; amount: string; reason: string; createdById: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  const session = await getCashSessionWithRegister(input.cashSessionId);
  if (!session || session.status !== "open" || session.locationId !== input.locationId) throw new Error("An open cash session at the selected location is required");
  if (!(Number(input.amount) > 0)) throw new Error("Safe-drop amount must be positive");
  const result = await db.insert(cashSafeDrops).values({ ...input, amount: input.amount, reason: input.reason.trim(), status: "pending" });
  return Number(result[0].insertId);
}

export async function listCashSafeDrops(locationId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(cashSafeDrops).where(eq(cashSafeDrops.locationId, locationId)).orderBy(desc(cashSafeDrops.createdAt)).limit(100);
}

export async function getCashSafeDrop(safeDropId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(cashSafeDrops).where(eq(cashSafeDrops.id, safeDropId)).limit(1);
  return rows[0];
}

export async function reviewCashSafeDrop(input: { safeDropId: number; approvedById: number; approve: boolean }) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  return db.transaction(async tx => {
    const drops = await tx.select().from(cashSafeDrops).where(eq(cashSafeDrops.id, input.safeDropId)).limit(1).for("update");
    const drop = drops[0];
    if (!drop || drop.status !== "pending") throw new Error("Safe drop is not pending review");
    assertIndependentCashReviewer(drop.createdById, input.approvedById, "safe drop");
    const status = input.approve ? "approved" : "rejected";
    await tx.update(cashSafeDrops).set({ status, approvedById: input.approvedById, approvedAt: new Date() }).where(eq(cashSafeDrops.id, drop.id));
    if (input.approve) await tx.update(cashSessions).set({ expectedCash: sql`${cashSessions.expectedCash} - ${drop.amount}` }).where(and(eq(cashSessions.id, drop.cashSessionId), eq(cashSessions.status, "open")));
    return { locationId: drop.locationId, status };
  });
}

export async function createCashMovement(input: { locationId: number; cashSessionId?: number; type: "cash_in" | "cash_out"; category: string; amount: string; note: string; createdById: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  if (!(Number(input.amount) > 0)) throw new Error("Cash movement amount must be positive");
  if (!input.note.trim()) throw new Error("A cash movement note is required");
  if (input.cashSessionId) {
    const session = await getCashSessionWithRegister(input.cashSessionId);
    if (!session || session.locationId !== input.locationId || session.status !== "open") throw new Error("An open cash session at the selected location is required");
  }
  const result = await db.insert(cashMovements).values({ ...input, cashSessionId: input.cashSessionId ?? null, category: input.category.trim(), amount: input.amount, note: input.note.trim() });
  return Number(result[0].insertId);
}

export async function listCashMovements(locationId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({ id: cashMovements.id, locationId: cashMovements.locationId, cashSessionId: cashMovements.cashSessionId, type: cashMovements.type, category: cashMovements.category, amount: cashMovements.amount, note: cashMovements.note, createdById: cashMovements.createdById, createdAt: cashMovements.createdAt, createdByName: users.name }).from(cashMovements).leftJoin(users, eq(cashMovements.createdById, users.id)).where(eq(cashMovements.locationId, locationId)).orderBy(desc(cashMovements.createdAt)).limit(100);
}

export async function recordStaffAttendance(input: { userId: number; locationId: number; eventType: "time_in" | "time_out"; note?: string | null; recordedById: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  const result = await db.insert(staffAttendance).values({ ...input, note: input.note?.trim() || null });
  return Number(result[0].insertId);
}

export async function listStaffAttendance(locationId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({ id: staffAttendance.id, userId: staffAttendance.userId, locationId: staffAttendance.locationId, eventType: staffAttendance.eventType, note: staffAttendance.note, recordedById: staffAttendance.recordedById, createdAt: staffAttendance.createdAt, staffName: users.name, staffRole: users.role }).from(staffAttendance).innerJoin(users, eq(staffAttendance.userId, users.id)).where(eq(staffAttendance.locationId, locationId)).orderBy(desc(staffAttendance.createdAt)).limit(100);
}

export function assertIndependentCashReviewer(originatorId: number | null, reviewerId: number, subject: "safe drop" | "cash variance") {
  if (originatorId === reviewerId) throw new Error(`A ${subject} must be approved by a different staff member`);
}

export async function approveCashVariance(input: { cashSessionId: number; approvedById: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  const rows = await db.select({ id: cashSessions.id, closedById: cashSessions.closedById, status: cashSessions.status, variance: cashSessions.variance, approval: cashSessions.varianceApprovalStatus }).from(cashSessions).where(eq(cashSessions.id, input.cashSessionId)).limit(1);
  const session = rows[0];
  if (!session || session.status !== "closed" || session.approval !== "pending") throw new Error("Cash session does not require variance approval");
  assertIndependentCashReviewer(session.closedById, input.approvedById, "cash variance");
  await db.update(cashSessions).set({ varianceApprovalStatus: "approved", varianceApprovedById: input.approvedById, varianceApprovedAt: new Date() }).where(eq(cashSessions.id, session.id));
  return { variance: session.variance };
}

export async function listPendingCashVariances(locationId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: cashSessions.id, registerCode: registers.code, registerName: registers.name, variance: cashSessions.variance,
    varianceReason: cashSessions.varianceReason, closedAt: cashSessions.closedAt, closedById: cashSessions.closedById,
  }).from(cashSessions).innerJoin(registers, eq(cashSessions.registerId, registers.id))
    .where(and(eq(registers.locationId, locationId), eq(cashSessions.status, "closed"), eq(cashSessions.varianceApprovalStatus, "pending"))).orderBy(desc(cashSessions.closedAt));
}

export async function listCategories() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(categories).where(eq(categories.isActive, true));
}

export async function getCategory(categoryId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(categories).where(eq(categories.id, categoryId)).limit(1);
  return result[0];
}

export async function createCategory(input: { name: string; description?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  const [result] = await db.insert(categories).values({ name: input.name.trim(), description: input.description?.trim() || null });
  return Number(result.insertId);
}

export async function updateCategory(input: { categoryId: number; name?: string; description?: string; isActive?: boolean }) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  await db.update(categories).set({ name: input.name?.trim(), description: input.description?.trim(), isActive: input.isActive }).where(eq(categories.id, input.categoryId));
}

export async function listProducts(search?: string) {
  const db = await getDb();
  if (!db) return [];
  const filter = search?.trim()
    ? and(eq(products.isActive, true), or(like(products.name, `%${search.trim()}%`), like(products.sku, `%${search.trim()}%`)))
    : eq(products.isActive, true);
  return db.select({
    id: products.id, sku: products.sku, name: products.name, description: products.description, price: products.price,
    costPrice: products.costPrice, taxRate: products.taxRate, isTaxInclusive: products.isTaxInclusive, categoryId: products.categoryId,
    categoryName: categories.name,
  }).from(products).leftJoin(categories, eq(products.categoryId, categories.id)).where(filter);
}

export async function getProduct(productId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select({
    id: products.id, sku: products.sku, name: products.name, description: products.description, price: products.price,
    costPrice: products.costPrice, taxRate: products.taxRate, isTaxInclusive: products.isTaxInclusive, isActive: products.isActive,
    categoryId: products.categoryId, categoryName: categories.name,
  }).from(products).leftJoin(categories, eq(products.categoryId, categories.id)).where(eq(products.id, productId)).limit(1);
  return result[0];
}

export async function createProduct(input: {
  sku: string; name: string; description?: string; categoryId?: number; price: string; costPrice: string; taxRate: string; isTaxInclusive: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  const [result] = await db.insert(products).values({
    sku: input.sku.trim().toUpperCase(), name: input.name.trim(), description: input.description?.trim() || null,
    categoryId: input.categoryId ?? null, price: input.price, costPrice: input.costPrice, taxRate: input.taxRate, isTaxInclusive: input.isTaxInclusive,
  });
  return Number(result.insertId);
}

export async function updateProduct(input: {
  productId: number; sku?: string; name?: string; description?: string; categoryId?: number | null; price?: string; costPrice?: string; taxRate?: string; isTaxInclusive?: boolean; isActive?: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  await db.update(products).set({
    sku: input.sku?.trim().toUpperCase(), name: input.name?.trim(), description: input.description?.trim(), categoryId: input.categoryId,
    price: input.price, costPrice: input.costPrice, taxRate: input.taxRate, isTaxInclusive: input.isTaxInclusive, isActive: input.isActive,
  }).where(eq(products.id, input.productId));
}

export async function listInventoryForLocation(locationId: number, search?: string) {
  const db = await getDb();
  if (!db) return [];
  const filter = search?.trim()
    ? and(eq(locationInventory.locationId, locationId), or(like(products.name, `%${search.trim()}%`), like(products.sku, `%${search.trim()}%`)))
    : eq(locationInventory.locationId, locationId);
  return db.select({
    inventoryId: locationInventory.id, productId: products.id, sku: products.sku, name: products.name, quantity: locationInventory.quantity,
    reservedQuantity: locationInventory.reservedQuantity, lowStockThreshold: locationInventory.lowStockThreshold,
    reorderQuantity: locationInventory.reorderQuantity, priceOverride: locationInventory.priceOverride, price: products.price,
    taxRate: products.taxRate, isTaxInclusive: products.isTaxInclusive, categoryName: categories.name,
  }).from(locationInventory).innerJoin(products, eq(locationInventory.productId, products.id)).leftJoin(categories, eq(products.categoryId, categories.id)).where(filter);
}

export async function listLowStockForLocation(locationId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    productId: products.id, sku: products.sku, name: products.name, quantity: locationInventory.quantity,
    lowStockThreshold: locationInventory.lowStockThreshold, reorderQuantity: locationInventory.reorderQuantity,
  }).from(locationInventory).innerJoin(products, eq(locationInventory.productId, products.id))
    .where(and(eq(locationInventory.locationId, locationId), lte(locationInventory.quantity, locationInventory.lowStockThreshold)));
}

export async function setLocationInventorySettings(input: {
  locationId: number; productId: number; lowStockThreshold: string; reorderQuantity: string; priceOverride?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  await db.insert(locationInventory).values({
    locationId: input.locationId, productId: input.productId, quantity: "0", lowStockThreshold: input.lowStockThreshold,
    reorderQuantity: input.reorderQuantity, priceOverride: input.priceOverride ?? null,
  }).onDuplicateKeyUpdate({ set: {
    lowStockThreshold: input.lowStockThreshold, reorderQuantity: input.reorderQuantity, priceOverride: input.priceOverride ?? null,
  } });
}

export async function adjustLocationInventory(input: {
  locationId: number; productId: number; quantityDelta: string; reason: "receiving" | "adjustment"; note?: string; createdById: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  const delta = Number(input.quantityDelta);
  if (!Number.isFinite(delta) || delta === 0) throw new Error("Inventory adjustment must be a non-zero decimal quantity");

  return db.transaction(async tx => {
    if (delta < 0) {
      const [result] = await tx.update(locationInventory).set({ quantity: sql`${locationInventory.quantity} + ${input.quantityDelta}` })
        .where(and(eq(locationInventory.locationId, input.locationId), eq(locationInventory.productId, input.productId), gte(locationInventory.quantity, Math.abs(delta).toString())));
      if (Number(result.affectedRows) !== 1) throw new Error("Insufficient stock for this reduction");
    } else {
      await tx.insert(locationInventory).values({ locationId: input.locationId, productId: input.productId, quantity: input.quantityDelta })
        .onDuplicateKeyUpdate({ set: { quantity: sql`${locationInventory.quantity} + ${input.quantityDelta}` } });
    }
    const [movement] = await tx.insert(stockMovements).values({
      locationId: input.locationId, productId: input.productId, quantityDelta: input.quantityDelta, movementType: input.reason,
      referenceType: "inventory_adjustment", note: input.note?.trim() || null, createdById: input.createdById,
    });
    return Number(movement.insertId);
  });
}

export async function listStockMovements(locationId: number, productId?: number) {
  const db = await getDb();
  if (!db) return [];
  const filter = productId ? and(eq(stockMovements.locationId, locationId), eq(stockMovements.productId, productId)) : eq(stockMovements.locationId, locationId);
  return db.select({
    id: stockMovements.id, productId: stockMovements.productId, sku: products.sku, name: products.name, quantityDelta: stockMovements.quantityDelta,
    movementType: stockMovements.movementType, referenceType: stockMovements.referenceType, referenceId: stockMovements.referenceId,
    note: stockMovements.note, createdAt: stockMovements.createdAt,
  }).from(stockMovements).innerJoin(products, eq(stockMovements.productId, products.id)).where(filter);
}

export async function createStockTransfer(input: {
  transferNumber: string; sourceLocationId: number; destinationLocationId: number; requestedById: number; note?: string;
  items: Array<{ productId: number; quantityRequested: string }>;
}) {
  if (input.sourceLocationId === input.destinationLocationId) throw new Error("Source and destination locations must be different");
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  return db.transaction(tx => applyStockTransferRequestInTransaction(tx, input));
}

export async function applyStockTransferRequestInTransaction(tx: any, input: { transferNumber: string; sourceLocationId: number; destinationLocationId: number; requestedById: number; note?: string; items: Array<{ productId: number; quantityRequested: string }> }) {
  if (input.sourceLocationId === input.destinationLocationId) throw new Error("Source and destination locations must be different");
  if (!input.items.length) throw new Error("At least one transfer item is required");
  const [transfer] = await tx.insert(stockTransfers).values({ transferNumber: input.transferNumber, sourceLocationId: input.sourceLocationId, destinationLocationId: input.destinationLocationId, requestedById: input.requestedById, note: input.note?.trim() || null });
  const transferId = Number(transfer.insertId);
  await tx.insert(stockTransferItems).values(input.items.map(item => ({ transferId, productId: item.productId, quantityRequested: item.quantityRequested })));
  return transferId;
}

export async function getStockTransfer(transferId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const header = await db.select().from(stockTransfers).where(eq(stockTransfers.id, transferId)).limit(1);
  if (!header[0]) return undefined;
  const items = await db.select({
    id: stockTransferItems.id, productId: stockTransferItems.productId, sku: products.sku, name: products.name,
    quantityRequested: stockTransferItems.quantityRequested, quantityShipped: stockTransferItems.quantityShipped, quantityReceived: stockTransferItems.quantityReceived,
  }).from(stockTransferItems).innerJoin(products, eq(stockTransferItems.productId, products.id)).where(eq(stockTransferItems.transferId, transferId));
  return { ...header[0], items };
}

export async function listStockTransfersForLocation(locationId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(stockTransfers).where(or(eq(stockTransfers.sourceLocationId, locationId), eq(stockTransfers.destinationLocationId, locationId)));
}

export async function applyStockTransferShipmentInTransaction(tx: any, transfer: any, items: any[], transferId: number, shippedById: number) {
  if (!transfer || transfer.status !== "requested") throw new Error("Only requested transfers can be shipped");
  for (const item of items) {
    const [result] = await tx.update(locationInventory).set({ quantity: sql`${locationInventory.quantity} - ${item.quantityRequested}` })
      .where(and(eq(locationInventory.locationId, transfer.sourceLocationId), eq(locationInventory.productId, item.productId), gte(locationInventory.quantity, item.quantityRequested)));
    if (Number(result.affectedRows) !== 1) throw new Error("Insufficient source inventory to ship this transfer");
    await tx.update(stockTransferItems).set({ quantityShipped: item.quantityRequested }).where(eq(stockTransferItems.id, item.id));
    await tx.insert(stockMovements).values({ locationId: transfer.sourceLocationId, productId: item.productId, quantityDelta: `-${item.quantityRequested}`, movementType: "transfer_shipment", referenceType: "stock_transfer", referenceId: transferId, createdById: shippedById });
  }
  await tx.update(stockTransfers).set({ status: "shipped", shippedById, shippedAt: new Date() }).where(eq(stockTransfers.id, transferId));
}

export async function shipStockTransfer(transferId: number, shippedById: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  return db.transaction(async tx => {
    const [transfer] = await tx.select().from(stockTransfers).where(eq(stockTransfers.id, transferId)).limit(1);
    const items = await tx.select().from(stockTransferItems).where(eq(stockTransferItems.transferId, transferId));
    return applyStockTransferShipmentInTransaction(tx, transfer, items, transferId, shippedById);
  });
}

export async function applyStockTransferReceiptInTransaction(tx: any, transfer: any, items: any[], transferId: number, receivedById: number) {
  if (!transfer || transfer.status !== "shipped") throw new Error("Only shipped transfers can be received");
  for (const item of items) {
    await tx.insert(locationInventory).values({ locationId: transfer.destinationLocationId, productId: item.productId, quantity: item.quantityShipped })
      .onDuplicateKeyUpdate({ set: { quantity: sql`${locationInventory.quantity} + ${item.quantityShipped}` } });
    await tx.update(stockTransferItems).set({ quantityReceived: item.quantityShipped }).where(eq(stockTransferItems.id, item.id));
    await tx.insert(stockMovements).values({ locationId: transfer.destinationLocationId, productId: item.productId, quantityDelta: item.quantityShipped, movementType: "transfer_receipt", referenceType: "stock_transfer", referenceId: transferId, createdById: receivedById });
  }
  await tx.update(stockTransfers).set({ status: "received", receivedById, receivedAt: new Date() }).where(eq(stockTransfers.id, transferId));
}

export async function receiveStockTransfer(transferId: number, receivedById: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  return db.transaction(async tx => {
    const [transfer] = await tx.select().from(stockTransfers).where(eq(stockTransfers.id, transferId)).limit(1);
    const items = await tx.select().from(stockTransferItems).where(eq(stockTransferItems.transferId, transferId));
    return applyStockTransferReceiptInTransaction(tx, transfer, items, transferId, receivedById);
  });
}

export async function applyStockTransferCancellationInTransaction(tx: any, transferId: number) {
  const [result] = await tx.update(stockTransfers).set({ status: "cancelled" }).where(and(eq(stockTransfers.id, transferId), eq(stockTransfers.status, "requested")));
  if (Number(result.affectedRows) !== 1) throw new Error("Only requested transfers can be cancelled");
}

export async function cancelStockTransfer(transferId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  return applyStockTransferCancellationInTransaction(db, transferId);
}

export async function getLoyaltyMemberByIdentifier(identifier: string) {
  const db = await getDb();
  if (!db) return undefined;
  const normalized = identifier.trim().toLowerCase();
  const result = await db
    .select()
    .from(loyaltyMembers)
    .where(or(eq(loyaltyMembers.email, normalized), eq(loyaltyMembers.mobile, identifier.trim())))
    .limit(1);
  return result[0];
}

export async function lookupLoyaltyMemberForStaff(identifier: string) {
  const db = await getDb();
  if (!db) return undefined;
  const trimmed = identifier.trim();
  const normalized = trimmed.toLowerCase();
  const result = await db.select({
    id: loyaltyMembers.id, memberNumber: loyaltyMembers.memberNumber, firstName: loyaltyMembers.firstName, lastName: loyaltyMembers.lastName,
    mobile: loyaltyMembers.mobile, email: loyaltyMembers.email, status: loyaltyMembers.status, currentPoints: loyaltyAccounts.currentPoints,
    cardNumber: loyaltyCards.cardNumber, displayToken: loyaltyCards.displayToken,
  }).from(loyaltyMembers).leftJoin(loyaltyAccounts, eq(loyaltyAccounts.memberId, loyaltyMembers.id))
    .leftJoin(loyaltyCards, eq(loyaltyCards.memberId, loyaltyMembers.id))
    .where(or(
      eq(loyaltyMembers.memberNumber, trimmed.toUpperCase()), eq(loyaltyMembers.mobile, trimmed), eq(loyaltyMembers.email, normalized), eq(loyaltyCards.displayToken, trimmed),
    )).limit(1);
  return result[0];
}

export async function listPurchaseRequests(locationId: number) {
  const db = await getDb(); if (!db) return [];
  return db.select().from(purchaseRequests).where(eq(purchaseRequests.locationId, locationId)).orderBy(desc(purchaseRequests.createdAt));
}

export async function listPurchaseOrders(locationId: number) {
  const db = await getDb(); if (!db) return [];
  return db.select().from(purchaseOrders).where(eq(purchaseOrders.locationId, locationId)).orderBy(desc(purchaseOrders.createdAt));
}

export async function getPurchaseRequest(requestId: number) {
  const db = await getDb(); if (!db) return undefined;
  const [header] = await db.select().from(purchaseRequests).where(eq(purchaseRequests.id, requestId)).limit(1);
  if (!header) return undefined;
  const items = await db.select({ id: purchaseRequestItems.id, requestId: purchaseRequestItems.requestId, productId: purchaseRequestItems.productId, quantityRequested: purchaseRequestItems.quantityRequested, note: purchaseRequestItems.note, productName: products.name, sku: products.sku }).from(purchaseRequestItems).innerJoin(products, eq(purchaseRequestItems.productId, products.id)).where(eq(purchaseRequestItems.requestId, requestId));
  return { ...header, items };
}

export async function getPurchaseOrder(orderId: number) {
  const db = await getDb(); if (!db) return undefined;
  const [header] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, orderId)).limit(1);
  if (!header) return undefined;
  const items = await db.select({ id: purchaseOrderItems.id, orderId: purchaseOrderItems.orderId, productId: purchaseOrderItems.productId, quantityOrdered: purchaseOrderItems.quantityOrdered, quantityReceived: purchaseOrderItems.quantityReceived, unitCost: purchaseOrderItems.unitCost, productName: products.name, sku: products.sku }).from(purchaseOrderItems).innerJoin(products, eq(purchaseOrderItems.productId, products.id)).where(eq(purchaseOrderItems.orderId, orderId));
  return { ...header, items };
}

export async function createPurchaseRequest(input: { locationId: number; requestedById: number; requestNumber: string; note?: string; items: { productId: number; quantityRequested: string; note?: string }[] }) {
  const db = await getDb(); if (!db) throw new Error("Database is unavailable");
  return db.transaction(async tx => { const [result] = await tx.insert(purchaseRequests).values({ locationId: input.locationId, requestedById: input.requestedById, requestNumber: input.requestNumber, note: input.note?.trim() || null }); const requestId = Number(result.insertId); await tx.insert(purchaseRequestItems).values(input.items.map(item => ({ requestId, productId: item.productId, quantityRequested: item.quantityRequested, note: item.note?.trim() || null }))); return requestId; });
}

export async function updatePurchaseRequestStatus(requestId: number, status: "submitted" | "approved" | "rejected" | "converted", approvedById?: number, rejectionReason?: string) {
  const db = await getDb(); if (!db) throw new Error("Database is unavailable");
  const values: any = { status, rejectionReason: rejectionReason?.trim() || null };
  if (status === "submitted") values.submittedAt = new Date();
  if (status === "approved") { values.approvedById = approvedById; values.approvedAt = new Date(); }
  await db.update(purchaseRequests).set(values).where(eq(purchaseRequests.id, requestId));
}

export async function createPurchaseOrder(input: { locationId: number; requestId?: number; createdById: number; orderNumber: string; supplierName: string; note?: string; items: { productId: number; quantityOrdered: string; unitCost: string }[] }) {
  const db = await getDb(); if (!db) throw new Error("Database is unavailable");
  return db.transaction(async tx => { const [result] = await tx.insert(purchaseOrders).values({ locationId: input.locationId, requestId: input.requestId ?? null, createdById: input.createdById, orderNumber: input.orderNumber, supplierName: input.supplierName.trim(), note: input.note?.trim() || null }); const orderId = Number(result.insertId); await tx.insert(purchaseOrderItems).values(input.items.map(item => ({ orderId, productId: item.productId, quantityOrdered: item.quantityOrdered, unitCost: item.unitCost }))); if (input.requestId) await tx.update(purchaseRequests).set({ status: "converted" }).where(eq(purchaseRequests.id, input.requestId)); return orderId; });
}

export async function updatePurchaseOrderStatus(orderId: number, status: "submitted" | "approved" | "ordered" | "cancelled", approvedById?: number) {
  const db = await getDb(); if (!db) throw new Error("Database is unavailable");
  const values: any = { status }; if (status === "approved") { values.approvedById = approvedById; values.approvedAt = new Date(); } if (status === "ordered") values.orderedAt = new Date(); await db.update(purchaseOrders).set(values).where(eq(purchaseOrders.id, orderId));
}

export async function receivePurchaseOrder(orderId: number, receivedById: number, items: { itemId: number; quantityReceived: string }[]) {
  const db = await getDb(); if (!db) throw new Error("Database is unavailable");
  return db.transaction(async tx => { const [order] = await tx.select().from(purchaseOrders).where(eq(purchaseOrders.id, orderId)).limit(1); if (!order || !["ordered", "partially_received"].includes(order.status)) throw new Error("Only ordered purchase orders can be received"); for (const item of items) { const [line] = await tx.select().from(purchaseOrderItems).where(and(eq(purchaseOrderItems.id, item.itemId), eq(purchaseOrderItems.orderId, orderId))).limit(1); if (!line) throw new Error("Purchase order item was not found"); const qty = Number(item.quantityReceived); if (qty <= 0 || qty > Number(line.quantityOrdered) - Number(line.quantityReceived)) throw new Error("Received quantity exceeds the outstanding quantity"); await tx.update(purchaseOrderItems).set({ quantityReceived: sql`${purchaseOrderItems.quantityReceived} + ${qty}` }).where(eq(purchaseOrderItems.id, line.id)); await tx.insert(locationInventory).values({ locationId: order.locationId, productId: line.productId, quantity: qty.toFixed(3) }).onDuplicateKeyUpdate({ set: { quantity: sql`${locationInventory.quantity} + ${qty}` } }); await tx.insert(stockMovements).values({ locationId: order.locationId, productId: line.productId, quantityDelta: qty.toFixed(3), movementType: "receiving", referenceType: "purchase_order", referenceId: orderId, createdById: receivedById }); } const outstanding = await tx.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.orderId, orderId)); const complete = outstanding.every(line => Number(line.quantityReceived) >= Number(line.quantityOrdered)); await tx.update(purchaseOrders).set({ status: complete ? "received" : "partially_received", receivedAt: complete ? new Date() : null }).where(eq(purchaseOrders.id, orderId)); return { complete }; });
}

export async function listLoyaltyMembersForStaff(search?: string) {
  const db = await getDb();
  if (!db) return [];
  const trimmed = search?.trim();
  const filter = trimmed
    ? and(eq(loyaltyMembers.status, "active"), or(like(loyaltyMembers.memberNumber, `%${trimmed.toUpperCase()}%`), like(loyaltyMembers.firstName, `%${trimmed}%`), like(loyaltyMembers.lastName, `%${trimmed}%`), like(loyaltyMembers.mobile, `%${trimmed}%`), like(loyaltyMembers.email, `%${trimmed.toLowerCase()}%`)))
    : eq(loyaltyMembers.status, "active");
  return db.select({
    id: loyaltyMembers.id, memberNumber: loyaltyMembers.memberNumber, firstName: loyaltyMembers.firstName, lastName: loyaltyMembers.lastName,
    mobile: loyaltyMembers.mobile, email: loyaltyMembers.email, joinedAt: loyaltyMembers.joinedAt, currentPoints: loyaltyAccounts.currentPoints,
  }).from(loyaltyMembers).leftJoin(loyaltyAccounts, eq(loyaltyAccounts.memberId, loyaltyMembers.id)).where(filter).orderBy(desc(loyaltyMembers.joinedAt)).limit(100);
}

export async function getLoyaltyMemberById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(loyaltyMembers).where(eq(loyaltyMembers.id, id)).limit(1);
  return result[0];
}

export async function getLoyaltyAccountByMemberId(memberId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(loyaltyAccounts).where(eq(loyaltyAccounts.memberId, memberId)).limit(1);
  return result[0];
}

export async function getLoyaltyMemberDetail(memberId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select({
    id: loyaltyMembers.id, memberNumber: loyaltyMembers.memberNumber, firstName: loyaltyMembers.firstName, lastName: loyaltyMembers.lastName,
    mobile: loyaltyMembers.mobile, email: loyaltyMembers.email, status: loyaltyMembers.status, joinedAt: loyaltyMembers.joinedAt,
    currentPoints: loyaltyAccounts.currentPoints, lifetimeEarned: loyaltyAccounts.lifetimeEarned, lifetimeRedeemed: loyaltyAccounts.lifetimeRedeemed,
    cardNumber: loyaltyCards.cardNumber, displayToken: loyaltyCards.displayToken, cardStatus: loyaltyCards.status,
  }).from(loyaltyMembers).leftJoin(loyaltyAccounts, eq(loyaltyAccounts.memberId, loyaltyMembers.id)).leftJoin(loyaltyCards, eq(loyaltyCards.memberId, loyaltyMembers.id))
    .where(eq(loyaltyMembers.id, memberId)).limit(1);
  return result[0];
}

export async function listMemberPurchases(memberId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({ id: sales.id, receiptNumber: sales.receiptNumber, locationId: sales.locationId, totalAmount: sales.totalAmount, pointsEarned: sales.pointsEarned, status: sales.status, createdAt: sales.createdAt })
    .from(sales).where(eq(sales.memberId, memberId)).orderBy(desc(sales.createdAt)).limit(30);
}

export async function listMemberPointTransactions(memberId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({ id: loyaltyTransactions.id, type: loyaltyTransactions.type, points: loyaltyTransactions.points, balanceAfter: loyaltyTransactions.balanceAfter, saleId: loyaltyTransactions.saleId, locationId: loyaltyTransactions.locationId, note: loyaltyTransactions.note, createdAt: loyaltyTransactions.createdAt })
    .from(loyaltyTransactions).where(eq(loyaltyTransactions.memberId, memberId)).orderBy(desc(loyaltyTransactions.createdAt)).limit(50);
}

export async function applyLoyaltyAdjustmentInTransaction(tx: any, input: { memberId: number; points: number; note: string; createdById: number }) {
  const account = await tx.select().from(loyaltyAccounts).where(eq(loyaltyAccounts.memberId, input.memberId)).limit(1);
  if (!account[0]) throw new Error("Loyalty account was not found");
  const balanceAfter = account[0].currentPoints + input.points;
  if (balanceAfter < 0) throw new Error("Point adjustment cannot create a negative balance");
  await tx.update(loyaltyAccounts).set({ currentPoints: balanceAfter }).where(eq(loyaltyAccounts.id, account[0].id));
  await tx.insert(loyaltyTransactions).values({ memberId: input.memberId, accountId: account[0].id, type: "adjustment", points: input.points, balanceAfter, note: input.note.trim(), createdById: input.createdById });
  return balanceAfter;
}

export async function adjustLoyaltyPoints(input: { memberId: number; points: number; note: string; createdById: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  return db.transaction(tx => applyLoyaltyAdjustmentInTransaction(tx, input));
}

type CreateLoyaltyMemberInput = {
  firstName: string;
  lastName: string;
  mobile: string;
  email?: string;
  passwordHash: string;
  joinedLocationId?: number;
};

export async function createLoyaltyMember(input: CreateLoyaltyMemberInput) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");

  return db.transaction(async tx => {
    const memberNumber = generateMemberNumber();
    const cardNumber = `CARD-${memberNumber.replace("LOY-", "")}`;
    const displayToken = generateMemberCardToken();
    const [memberResult] = await tx.insert(loyaltyMembers).values({
      memberNumber,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      mobile: input.mobile.trim(),
      email: input.email?.trim().toLowerCase() || null,
      passwordHash: input.passwordHash,
      joinedLocationId: input.joinedLocationId ?? null,
    });
    const memberId = Number(memberResult.insertId);

    await tx.insert(loyaltyCards).values({ memberId, cardNumber, displayToken });
    await tx.insert(loyaltyAccounts).values({ memberId });

    return { memberId, memberNumber, cardNumber, displayToken };
  });
}


export type HistoricalReportInput = { locationId: number; startDate: Date; endDate: Date };

export async function getLocationHistoricalReport(input: HistoricalReportInput) {
  const db = await getDb();
  const startDate = new Date(input.startDate); startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(input.endDate); endDate.setHours(23, 59, 59, 999);
  if (!db) return { startDate, endDate, revenue: "0.00", transactionCount: 0, trend: [], topProducts: [] };
  const condition = and(eq(sales.locationId, input.locationId), eq(sales.status, "completed"), gte(sales.createdAt, startDate), lte(sales.createdAt, endDate));
  const totals = await db.select({ revenue: sql<string>`coalesce(sum(${sales.totalAmount}), 0)`, transactionCount: sql<number>`count(*)` }).from(sales).where(condition);
  const trend = await db.select({ bucket: sql<string>`date(${sales.createdAt})`, revenue: sql<string>`coalesce(sum(${sales.totalAmount}), 0)`, transactionCount: sql<number>`count(*)` })
    .from(sales).where(condition).groupBy(sql`date(${sales.createdAt})`).orderBy(sql`date(${sales.createdAt})`);
  const topProducts = await db.select({ name: saleItems.nameSnapshot, sku: saleItems.skuSnapshot, quantity: sql<string>`coalesce(sum(${saleItems.quantity}), 0)`, revenue: sql<string>`coalesce(sum(${saleItems.lineTotal}), 0)` })
    .from(saleItems).innerJoin(sales, eq(saleItems.saleId, sales.id)).where(condition).groupBy(saleItems.productId, saleItems.nameSnapshot, saleItems.skuSnapshot)
    .orderBy(sql`sum(${saleItems.lineTotal}) desc`).limit(10);
  return { startDate, endDate, revenue: String(totals[0]?.revenue ?? "0.00"), transactionCount: Number(totals[0]?.transactionCount ?? 0), trend: trend.map(item => ({ bucket: item.bucket, revenue: String(item.revenue ?? "0.00"), transactionCount: Number(item.transactionCount ?? 0) })), topProducts };
}

export async function listReportTemplates(ownerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(reportTemplates).where(eq(reportTemplates.ownerId, ownerId)).orderBy(desc(reportTemplates.updatedAt));
}

export async function createReportTemplate(input: { ownerId: number; locationId?: number | null; name: string; metric: "revenue" | "transactions" | "products"; groupBy: "products" | "locations"; presentation: "bars" | "table"; startDate?: Date | null; endDate?: Date | null }) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  const [result] = await db.insert(reportTemplates).values({ ...input, locationId: input.locationId ?? null, startDate: input.startDate ?? null, endDate: input.endDate ?? null });
  return Number(result.insertId);
}

export async function updateReportTemplate(input: { id: number; ownerId: number; locationId?: number | null; name?: string; metric?: "revenue" | "transactions" | "products"; groupBy?: "products" | "locations"; presentation?: "bars" | "table"; startDate?: Date | null; endDate?: Date | null }) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  const { id, ownerId, ...changes } = input;
  await db.update(reportTemplates).set({ ...changes, locationId: changes.locationId ?? null, startDate: changes.startDate ?? null, endDate: changes.endDate ?? null }).where(and(eq(reportTemplates.id, id), eq(reportTemplates.ownerId, ownerId)));
}

export async function deleteReportTemplate(id: number, ownerId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  await db.delete(reportTemplates).where(and(eq(reportTemplates.id, id), eq(reportTemplates.ownerId, ownerId)));
}


export async function listEmployeeProfiles(search?: string) {
  const db = await getDb();
  if (!db) return [];
  const term = search?.trim();
  return db.select().from(employeeProfiles).where(term ? or(like(employeeProfiles.employeeNumber, `%${term}%`), like(employeeProfiles.firstName, `%${term}%`), like(employeeProfiles.lastName, `%${term}%`), like(employeeProfiles.department, `%${term}%`)) : undefined).orderBy(employeeProfiles.lastName, employeeProfiles.firstName);
}

export async function createEmployeeProfile(input: { employeeNumber: string; firstName: string; middleName?: string; lastName: string; birthDate?: Date; sex?: "female" | "male" | "prefer_not_to_say"; civilStatus?: "single" | "married" | "widowed" | "separated"; mobile?: string; personalEmail?: string; address?: string; hireDate?: Date; employmentStatus?: "active" | "probationary" | "on_leave" | "inactive" | "separated"; department?: string; position?: string; managerId?: number; tin?: string; sssNumber?: string; philhealthNumber?: string; pagibigNumber?: string; emergencyContactName?: string; emergencyContactPhone?: string; userId?: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  const [result] = await db.insert(employeeProfiles).values({ ...input, middleName: input.middleName || null, birthDate: input.birthDate || null, sex: input.sex || null, civilStatus: input.civilStatus || null, mobile: input.mobile || null, personalEmail: input.personalEmail || null, address: input.address || null, hireDate: input.hireDate || null, employmentStatus: input.employmentStatus ?? "active", department: input.department || null, position: input.position || null, managerId: input.managerId || null, tin: input.tin || null, sssNumber: input.sssNumber || null, philhealthNumber: input.philhealthNumber || null, pagibigNumber: input.pagibigNumber || null, emergencyContactName: input.emergencyContactName || null, emergencyContactPhone: input.emergencyContactPhone || null, userId: input.userId || null });
  return Number(result.insertId);
}

export async function listEmployeeCompensation(employeeId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(employeeCompensation).where(eq(employeeCompensation.employeeId, employeeId)).orderBy(desc(employeeCompensation.effectiveDate));
}

export async function createEmployeeCompensation(input: { employeeId: number; effectiveDate: Date; salaryType: "monthly" | "daily" | "hourly"; baseSalary: string; allowances?: unknown; payFrequency: "monthly" | "semi_monthly" | "weekly"; notes?: string; createdById: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  const [result] = await db.insert(employeeCompensation).values({ ...input, allowances: input.allowances ?? null, notes: input.notes || null });
  return Number(result.insertId);
}

export async function listEmployeeCertificates(employeeId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(employeeCertificates).where(eq(employeeCertificates.employeeId, employeeId)).orderBy(desc(employeeCertificates.expiryDate));
}

export async function createEmployeeCertificate(input: { employeeId: number; certificateType: string; certificateNumber?: string; issuedDate?: Date; expiryDate?: Date; issuer?: string; status?: "valid" | "expiring" | "expired" | "pending"; notes?: string; createdById: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  const [result] = await db.insert(employeeCertificates).values({ ...input, certificateNumber: input.certificateNumber || null, issuedDate: input.issuedDate || null, expiryDate: input.expiryDate || null, issuer: input.issuer || null, status: input.status ?? "valid", notes: input.notes || null });
  return Number(result.insertId);
}

export async function listEmployeeLeaveRequests(employeeId?: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(employeeLeaveRequests).where(employeeId ? eq(employeeLeaveRequests.employeeId, employeeId) : undefined).orderBy(desc(employeeLeaveRequests.createdAt));
}

export async function createEmployeeLeaveRequest(input: { employeeId: number; leaveType: "vacation" | "sick" | "emergency" | "service_incentive" | "other"; startDate: Date; endDate: Date; reason?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  const [result] = await db.insert(employeeLeaveRequests).values({ ...input, reason: input.reason || null });
  return Number(result.insertId);
}

export async function updateEmployeeLeaveStatus(input: { id: number; status: "approved" | "rejected" | "cancelled"; reviewedById: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  await db.update(employeeLeaveRequests).set({ status: input.status, reviewedById: input.reviewedById, reviewedAt: new Date() }).where(eq(employeeLeaveRequests.id, input.id));
}

export async function listPhilippineHolidays(year: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(philippineHolidays).where(eq(philippineHolidays.year, year)).orderBy(philippineHolidays.holidayDate);
}

export async function createPhilippineHoliday(input: { holidayDate: Date; name: string; holidayType: "regular" | "special_non_working" | "special_working"; year: number; notes?: string; createdById: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  const [result] = await db.insert(philippineHolidays).values({ ...input, notes: input.notes || null });
  return Number(result.insertId);
}


export async function getEmployeeProfileByUserId(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(employeeProfiles).where(eq(employeeProfiles.userId, userId)).limit(1);
  return result[0];
}


export async function listTimekeepingSchedules() {
  const db = await getDb(); if (!db) return [];
  return db.select().from(timekeepingSchedules).orderBy(timekeepingSchedules.startTime);
}
export async function createTimekeepingSchedule(input: { name: string; startTime: string; endTime: string; graceMinutes: number; daysOfWeek: number[]; createdById: number }) {
  const db = await getDb(); if (!db) throw new Error("Database is unavailable");
  const [result] = await db.insert(timekeepingSchedules).values({ ...input, daysOfWeek: input.daysOfWeek }); return Number(result.insertId);
}
export async function listTimekeepingRequests(userId?: number) {
  const db = await getDb(); if (!db) return [];
  return db.select().from(timekeepingScheduleRequests).where(userId ? eq(timekeepingScheduleRequests.userId, userId) : undefined).orderBy(desc(timekeepingScheduleRequests.createdAt));
}
export async function createTimekeepingRequest(input: { userId: number; requestedDate: Date; scheduleId?: number; requestType: "schedule_change" | "time_correction" | "overtime"; reason: string }) {
  const db = await getDb(); if (!db) throw new Error("Database is unavailable");
  const [result] = await db.insert(timekeepingScheduleRequests).values({ ...input, scheduleId: input.scheduleId || null }); return Number(result.insertId);
}
export async function updateTimekeepingRequest(input: { id: number; status: "approved" | "rejected" | "cancelled"; reviewedById: number }) {
  const db = await getDb(); if (!db) throw new Error("Database is unavailable");
  await db.update(timekeepingScheduleRequests).set({ status: input.status, reviewedById: input.reviewedById, reviewedAt: new Date() }).where(eq(timekeepingScheduleRequests.id, input.id));
}


export async function listStaffAttendanceRange(locationId: number, start: Date, end: Date) {
  const db = await getDb();
  if (!db) return [];
  return db.select({ id: staffAttendance.id, userId: staffAttendance.userId, locationId: staffAttendance.locationId, eventType: staffAttendance.eventType, note: staffAttendance.note, recordedById: staffAttendance.recordedById, createdAt: staffAttendance.createdAt, staffName: users.name, staffRole: users.role }).from(staffAttendance).innerJoin(users, eq(staffAttendance.userId, users.id)).where(and(eq(staffAttendance.locationId, locationId), gte(staffAttendance.createdAt, start), lte(staffAttendance.createdAt, end))).orderBy(staffAttendance.createdAt);
}

export async function listPayrollRuns() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(payrollRuns).orderBy(desc(payrollRuns.createdAt)).limit(50);
}

export async function getPayrollRun(id: number) {
  const db = await getDb();
  if (!db) return null;
  const [run] = await db.select().from(payrollRuns).where(eq(payrollRuns.id, id)).limit(1);
  if (!run) return null;
  const items = await db.select({ id: payrollItems.id, payrollRunId: payrollItems.payrollRunId, employeeId: payrollItems.employeeId, userId: payrollItems.userId, daysWorked: payrollItems.daysWorked, hoursWorked: payrollItems.hoursWorked, lateMinutes: payrollItems.lateMinutes, undertimeMinutes: payrollItems.undertimeMinutes, overtimeMinutes: payrollItems.overtimeMinutes, basePay: payrollItems.basePay, overtimePay: payrollItems.overtimePay, allowances: payrollItems.allowances, deductions: payrollItems.deductions, netPay: payrollItems.netPay, notes: payrollItems.notes, createdAt: payrollItems.createdAt, employeeName: users.name, employeeNumber: employeeProfiles.employeeNumber }).from(payrollItems).innerJoin(users, eq(payrollItems.userId, users.id)).leftJoin(employeeProfiles, eq(payrollItems.employeeId, employeeProfiles.id)).where(eq(payrollItems.payrollRunId, id)).orderBy(users.name);
  return { run, items };
}

function minutesBetween(start: Date, end: Date) { return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000)); }

export async function computePayroll(input: { periodStart: Date; periodEnd: Date; computedById: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  const attendance = await db.select({ userId: staffAttendance.userId, eventType: staffAttendance.eventType, createdAt: staffAttendance.createdAt }).from(staffAttendance).where(and(gte(staffAttendance.createdAt, input.periodStart), lte(staffAttendance.createdAt, input.periodEnd))).orderBy(staffAttendance.createdAt);
  const byUser = new Map<number, { timeIn?: Date; timeOut?: Date; days: Set<string>; late: number; undertime: number; overtime: number; hours: number }>();
  for (const row of attendance) {
    const key = row.userId; const day = row.createdAt.toISOString().slice(0, 10); const current = byUser.get(key) ?? { days: new Set<string>(), late: 0, undertime: 0, overtime: 0, hours: 0 };
    if (row.eventType === "time_in") { current.timeIn = row.createdAt; current.days.add(day); }
    if (row.eventType === "time_out" && current.timeIn) { current.timeOut = row.createdAt; const minutes = minutesBetween(current.timeIn, row.createdAt); current.hours += minutes / 60; const late = Math.max(0, (current.timeIn.getHours() * 60 + current.timeIn.getMinutes()) - 9 * 60); current.late += late; current.overtime += Math.max(0, minutes - 8 * 60); current.undertime += Math.max(0, 8 * 60 - minutes); current.timeIn = undefined; current.timeOut = undefined; }
    byUser.set(key, current);
  }
  const items: Array<typeof payrollItems.$inferInsert> = [];
  for (const [userId, stats] of Array.from(byUser.entries())) {
    const [profile] = await db.select().from(employeeProfiles).where(eq(employeeProfiles.userId, userId)).limit(1);
    const compensation = profile ? (await db.select().from(employeeCompensation).where(eq(employeeCompensation.employeeId, profile.id)).orderBy(desc(employeeCompensation.effectiveDate)).limit(1))[0] : null;
    const baseSalary = Number(compensation?.baseSalary ?? 0); const salaryType = compensation?.salaryType ?? "daily"; const dailyRate = salaryType === "monthly" ? baseSalary / 26 : salaryType === "hourly" ? baseSalary * 8 : baseSalary; const basePay = stats.days.size * dailyRate; const overtimePay = (dailyRate / 8) * 1.25 * (stats.overtime / 60); const allowances = compensation?.allowances && typeof compensation.allowances === "object" ? Object.values(compensation.allowances as Record<string, number>).reduce((sum, value) => sum + Number(value || 0), 0) : 0; const undertimeDeduction = (dailyRate / 8) * (stats.undertime / 60); const netPay = Math.max(0, basePay + overtimePay + allowances - undertimeDeduction);
    items.push({ payrollRunId: 0, employeeId: profile?.id ?? null, userId, daysWorked: stats.days.size.toFixed(2), hoursWorked: stats.hours.toFixed(2), lateMinutes: stats.late, undertimeMinutes: stats.undertime, overtimeMinutes: stats.overtime, basePay: basePay.toFixed(2), overtimePay: overtimePay.toFixed(2), allowances: allowances.toFixed(2), deductions: undertimeDeduction.toFixed(2), netPay: netPay.toFixed(2), notes: compensation ? null : "No active compensation record; computed at zero base pay" });
  }
  const totalGross = items.reduce((sum, item) => sum + Number(item.basePay) + Number(item.overtimePay) + Number(item.allowances), 0); const totalDeductions = items.reduce((sum, item) => sum + Number(item.deductions), 0); const totalNet = items.reduce((sum, item) => sum + Number(item.netPay), 0);
  const [runResult] = await db.insert(payrollRuns).values({ ...input, status: "computed", totalGross: totalGross.toFixed(2), totalDeductions: totalDeductions.toFixed(2), totalNet: totalNet.toFixed(2) }); const runId = Number(runResult.insertId);
  if (items.length) await db.insert(payrollItems).values(items.map(item => ({ ...item, payrollRunId: runId })));
  return { runId, itemCount: items.length, totalGross: totalGross.toFixed(2), totalDeductions: totalDeductions.toFixed(2), totalNet: totalNet.toFixed(2) };
}

export async function updatePayrollRunStatus(id: number, status: "approved" | "paid", userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  await db.update(payrollRuns).set({ status, approvedById: status === "approved" ? userId : undefined, approvedAt: status === "approved" ? new Date() : undefined }).where(eq(payrollRuns.id, id));
}
