import { and, desc, eq, gte, like, lte, ne, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  categories,
  cashSessions,
  locationInventory,
  loyaltyAccounts,
  loyaltyCards,
  loyaltyMembers,
  loyaltyTransactions,
  locations,
  products,
  registers,
  saleItems,
  sales,
  systemSettings,
  stockMovements,
  stockTransferItems,
  stockTransfers,
  staffMenuAssignments,
  userLocations,
  users,
} from "../drizzle/schema";
import type { StaffRole } from "./authTokens";
import { DEFAULT_MENU_ACCESS, RETAIL_MENU_KEYS, type RetailMenuKey } from "../shared/retailAccess";
import { generateMemberCardToken, generateMemberNumber } from "./posRules";
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

export async function closeCashSession(input: { cashSessionId: number; closedById: number; closingCash: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  const session = await getCashSessionWithRegister(input.cashSessionId);
  if (!session || session.status !== "open") throw new Error("Cash session is not available for closing");
  const countedCash = Number(input.closingCash);
  const expectedCash = Number(session.expectedCash);
  if (!Number.isFinite(countedCash) || countedCash < 0) throw new Error("Counted cash must be a valid non-negative PHP amount");
  const variance = (countedCash - expectedCash).toFixed(2);
  await db.update(cashSessions).set({
    status: "closed", closedById: input.closedById, closingCash: input.closingCash, variance, closedAt: new Date(),
  }).where(and(eq(cashSessions.id, input.cashSessionId), eq(cashSessions.status, "open")));
  return { expectedCash: expectedCash.toFixed(2), closingCash: countedCash.toFixed(2), variance };
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
    taxRate: products.taxRate, isTaxInclusive: products.isTaxInclusive,
  }).from(locationInventory).innerJoin(products, eq(locationInventory.productId, products.id)).where(filter);
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
  return db.transaction(async tx => {
    const [transfer] = await tx.insert(stockTransfers).values({
      transferNumber: input.transferNumber, sourceLocationId: input.sourceLocationId, destinationLocationId: input.destinationLocationId,
      requestedById: input.requestedById, note: input.note?.trim() || null,
    });
    const transferId = Number(transfer.insertId);
    await tx.insert(stockTransferItems).values(input.items.map(item => ({ transferId, productId: item.productId, quantityRequested: item.quantityRequested })));
    return transferId;
  });
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

export async function shipStockTransfer(transferId: number, shippedById: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  return db.transaction(async tx => {
    const [transfer] = await tx.select().from(stockTransfers).where(eq(stockTransfers.id, transferId)).limit(1);
    if (!transfer || transfer.status !== "requested") throw new Error("Only requested transfers can be shipped");
    const items = await tx.select().from(stockTransferItems).where(eq(stockTransferItems.transferId, transferId));
    for (const item of items) {
      const [result] = await tx.update(locationInventory).set({ quantity: sql`${locationInventory.quantity} - ${item.quantityRequested}` })
        .where(and(eq(locationInventory.locationId, transfer.sourceLocationId), eq(locationInventory.productId, item.productId), gte(locationInventory.quantity, item.quantityRequested)));
      if (Number(result.affectedRows) !== 1) throw new Error("Insufficient source inventory to ship this transfer");
      await tx.update(stockTransferItems).set({ quantityShipped: item.quantityRequested }).where(eq(stockTransferItems.id, item.id));
      await tx.insert(stockMovements).values({
        locationId: transfer.sourceLocationId, productId: item.productId, quantityDelta: `-${item.quantityRequested}`, movementType: "transfer_shipment",
        referenceType: "stock_transfer", referenceId: transferId, createdById: shippedById,
      });
    }
    await tx.update(stockTransfers).set({ status: "shipped", shippedById, shippedAt: new Date() }).where(eq(stockTransfers.id, transferId));
  });
}

export async function receiveStockTransfer(transferId: number, receivedById: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  return db.transaction(async tx => {
    const [transfer] = await tx.select().from(stockTransfers).where(eq(stockTransfers.id, transferId)).limit(1);
    if (!transfer || transfer.status !== "shipped") throw new Error("Only shipped transfers can be received");
    const items = await tx.select().from(stockTransferItems).where(eq(stockTransferItems.transferId, transferId));
    for (const item of items) {
      await tx.insert(locationInventory).values({ locationId: transfer.destinationLocationId, productId: item.productId, quantity: item.quantityShipped })
        .onDuplicateKeyUpdate({ set: { quantity: sql`${locationInventory.quantity} + ${item.quantityShipped}` } });
      await tx.update(stockTransferItems).set({ quantityReceived: item.quantityShipped }).where(eq(stockTransferItems.id, item.id));
      await tx.insert(stockMovements).values({
        locationId: transfer.destinationLocationId, productId: item.productId, quantityDelta: item.quantityShipped, movementType: "transfer_receipt",
        referenceType: "stock_transfer", referenceId: transferId, createdById: receivedById,
      });
    }
    await tx.update(stockTransfers).set({ status: "received", receivedById, receivedAt: new Date() }).where(eq(stockTransfers.id, transferId));
  });
}

export async function cancelStockTransfer(transferId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  const [result] = await db.update(stockTransfers).set({ status: "cancelled" }).where(and(eq(stockTransfers.id, transferId), eq(stockTransfers.status, "requested")));
  if (Number(result.affectedRows) !== 1) throw new Error("Only requested transfers can be cancelled");
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

export async function adjustLoyaltyPoints(input: { memberId: number; points: number; note: string; createdById: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  return db.transaction(async tx => {
    const account = await tx.select().from(loyaltyAccounts).where(eq(loyaltyAccounts.memberId, input.memberId)).limit(1);
    if (!account[0]) throw new Error("Loyalty account was not found");
    const balanceAfter = account[0].currentPoints + input.points;
    if (balanceAfter < 0) throw new Error("Point adjustment cannot create a negative balance");
    await tx.update(loyaltyAccounts).set({ currentPoints: balanceAfter }).where(eq(loyaltyAccounts.id, account[0].id));
    await tx.insert(loyaltyTransactions).values({ memberId: input.memberId, accountId: account[0].id, type: "adjustment", points: input.points, balanceAfter, note: input.note.trim(), createdById: input.createdById });
    return balanceAfter;
  });
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
