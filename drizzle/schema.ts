import {
  boolean,
  decimal,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const staffRoles = ["cashier", "manager", "admin"] as const;
const persistedUserRoles = ["user", ...staffRoles] as const;
export const staffMenuKeys = ["overview", "register", "inventory", "transfers", "members", "operations", "reports", "users", "compliance"] as const;

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).unique(),
  name: varchar("name", { length: 160 }),
  email: varchar("email", { length: 320 }).unique(),
  passwordHash: varchar("passwordHash", { length: 255 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", persistedUserRoles).default("cashier").notNull(),
  jobTitle: varchar("jobTitle", { length: 100 }),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const authRateLimits = mysqlTable(
  "authRateLimits",
  {
    id: int("id").autoincrement().primaryKey(),
    channel: mysqlEnum("channel", ["staff", "member"]).notNull(),
    keyHash: varchar("keyHash", { length: 64 }).notNull(),
    failures: int("failures").default(0).notNull(),
    windowEndsAt: timestamp("windowEndsAt").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("auth_rate_limits_channel_key_unique").on(table.channel, table.keyHash),
    index("auth_rate_limits_window_idx").on(table.windowEndsAt),
  ],
);

export const staffMenuAssignments = mysqlTable(
  "staffMenuAssignments",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    menuKey: mysqlEnum("menuKey", staffMenuKeys).notNull(),
    isEnabled: boolean("isEnabled").default(true).notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("staff_menu_assignment_unique").on(table.userId, table.menuKey)],
);

export const locations = mysqlTable(
  "locations",
  {
    id: int("id").autoincrement().primaryKey(),
    code: varchar("code", { length: 32 }).notNull().unique(),
    name: varchar("name", { length: 160 }).notNull(),
    type: mysqlEnum("type", ["store", "branch", "warehouse", "kiosk"]).default("store").notNull(),
    address: text("address"),
    city: varchar("city", { length: 120 }),
    province: varchar("province", { length: 120 }),
    postalCode: varchar("postalCode", { length: 20 }),
    phone: varchar("phone", { length: 40 }),
    isActive: boolean("isActive").default(true).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("locations_active_idx").on(table.isActive)],
);

export const businessProfiles = mysqlTable(
  "businessProfiles",
  {
    id: int("id").autoincrement().primaryKey(),
    legalName: varchar("legalName", { length: 240 }).notNull(),
    tradeName: varchar("tradeName", { length: 240 }),
    tin: varchar("tin", { length: 32 }).notNull(),
    vatStatus: mysqlEnum("vatStatus", ["vat", "non_vat"]).notNull(),
    registeredAddress: text("registeredAddress").notNull(),
    invoiceLabel: varchar("invoiceLabel", { length: 80 }).default("Invoice").notNull(),
    isActive: boolean("isActive").default(true).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("business_profiles_active_idx").on(table.isActive)],
);

export const taxRegistrations = mysqlTable(
  "taxRegistrations",
  {
    id: int("id").autoincrement().primaryKey(),
    businessProfileId: int("businessProfileId").notNull().references(() => businessProfiles.id, { onDelete: "restrict" }),
    birRdoCode: varchar("birRdoCode", { length: 16 }),
    certificateNumber: varchar("certificateNumber", { length: 80 }),
    effectiveFrom: timestamp("effectiveFrom"),
    effectiveTo: timestamp("effectiveTo"),
    status: mysqlEnum("status", ["active", "inactive"]).default("active").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("tax_registrations_profile_status_idx").on(table.businessProfileId, table.status)],
);

export const userLocations = mysqlTable(
  "userLocations",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    locationId: int("locationId").notNull().references(() => locations.id, { onDelete: "cascade" }),
    isPrimary: boolean("isPrimary").default(false).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("user_locations_unique").on(table.userId, table.locationId),
    index("user_locations_location_idx").on(table.locationId),
  ],
);

export const registers = mysqlTable(
  "registers",
  {
    id: int("id").autoincrement().primaryKey(),
    locationId: int("locationId").notNull().references(() => locations.id, { onDelete: "cascade" }),
    code: varchar("code", { length: 40 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    isActive: boolean("isActive").default(true).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("register_location_code_unique").on(table.locationId, table.code)],
);

export const invoiceSeries = mysqlTable(
  "invoiceSeries",
  {
    id: int("id").autoincrement().primaryKey(),
    businessProfileId: int("businessProfileId").notNull().references(() => businessProfiles.id, { onDelete: "restrict" }),
    locationId: int("locationId").notNull().references(() => locations.id, { onDelete: "restrict" }),
    code: varchar("code", { length: 32 }).notNull(),
    prefix: varchar("prefix", { length: 32 }).notNull(),
    nextSequence: int("nextSequence").default(1).notNull(),
    numberPadding: int("numberPadding").default(8).notNull(),
    isActive: boolean("isActive").default(true).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("invoice_series_location_code_unique").on(table.locationId, table.code),
    index("invoice_series_location_active_idx").on(table.locationId, table.isActive),
  ],
);

export const receiptDevices = mysqlTable(
  "receiptDevices",
  {
    id: int("id").autoincrement().primaryKey(),
    locationId: int("locationId").notNull().references(() => locations.id, { onDelete: "restrict" }),
    invoiceSeriesId: int("invoiceSeriesId").notNull().references(() => invoiceSeries.id, { onDelete: "restrict" }),
    code: varchar("code", { length: 40 }).notNull(),
    serialNumber: varchar("serialNumber", { length: 120 }),
    permitNumber: varchar("permitNumber", { length: 120 }),
    isActive: boolean("isActive").default(true).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("receipt_devices_location_code_unique").on(table.locationId, table.code),
    index("receipt_devices_series_active_idx").on(table.invoiceSeriesId, table.isActive),
  ],
);

export const cashSessions = mysqlTable(
  "cashSessions",
  {
    id: int("id").autoincrement().primaryKey(),
    registerId: int("registerId").notNull().references(() => registers.id, { onDelete: "restrict" }),
    openedById: int("openedById").notNull().references(() => users.id, { onDelete: "restrict" }),
    closedById: int("closedById").references(() => users.id, { onDelete: "restrict" }),
    status: mysqlEnum("status", ["open", "closed"]).default("open").notNull(),
    openingCash: decimal("openingCash", { precision: 14, scale: 2 }).notNull(),
    expectedCash: decimal("expectedCash", { precision: 14, scale: 2 }).default("0").notNull(),
    closingCash: decimal("closingCash", { precision: 14, scale: 2 }),
    variance: decimal("variance", { precision: 14, scale: 2 }),
    varianceReason: text("varianceReason"),
    varianceApprovalStatus: mysqlEnum("varianceApprovalStatus", ["not_required", "pending", "approved"]).default("not_required").notNull(),
    varianceApprovedById: int("varianceApprovedById").references(() => users.id, { onDelete: "restrict" }),
    varianceApprovedAt: timestamp("varianceApprovedAt"),
    openedAt: timestamp("openedAt").defaultNow().notNull(),
    closedAt: timestamp("closedAt"),
  },
  table => [index("cash_sessions_register_status_idx").on(table.registerId, table.status)],
);

export const cashCountEntries = mysqlTable(
  "cashCountEntries",
  {
    id: int("id").autoincrement().primaryKey(),
    cashSessionId: int("cashSessionId").notNull().references(() => cashSessions.id, { onDelete: "cascade" }),
    denomination: decimal("denomination", { precision: 14, scale: 2 }).notNull(),
    quantity: int("quantity").notNull(),
    countedAmount: decimal("countedAmount", { precision: 14, scale: 2 }).notNull(),
    countedById: int("countedById").notNull().references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [uniqueIndex("cash_count_session_denomination_unique").on(table.cashSessionId, table.denomination)],
);

export const cashSafeDrops = mysqlTable(
  "cashSafeDrops",
  {
    id: int("id").autoincrement().primaryKey(),
    cashSessionId: int("cashSessionId").notNull().references(() => cashSessions.id, { onDelete: "restrict" }),
    locationId: int("locationId").notNull().references(() => locations.id, { onDelete: "restrict" }),
    amount: decimal("amount", { precision: 14, scale: 2 }).notNull(),
    reason: text("reason").notNull(),
    status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("pending").notNull(),
    createdById: int("createdById").notNull().references(() => users.id, { onDelete: "restrict" }),
    approvedById: int("approvedById").references(() => users.id, { onDelete: "restrict" }),
    approvedAt: timestamp("approvedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("cash_safe_drops_session_status_idx").on(table.cashSessionId, table.status)],
);

export const cashMovements = mysqlTable(
  "cashMovements",
  {
    id: int("id").autoincrement().primaryKey(),
    locationId: int("locationId").notNull().references(() => locations.id, { onDelete: "restrict" }),
    cashSessionId: int("cashSessionId").references(() => cashSessions.id, { onDelete: "set null" }),
    type: mysqlEnum("type", ["cash_in", "cash_out"]).notNull(),
    category: varchar("category", { length: 100 }).notNull(),
    amount: decimal("amount", { precision: 14, scale: 2 }).notNull(),
    note: text("note").notNull(),
    createdById: int("createdById").notNull().references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("cash_movements_location_created_idx").on(table.locationId, table.createdAt)],
);

export const staffAttendance = mysqlTable(
  "staffAttendance",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "restrict" }),
    locationId: int("locationId").notNull().references(() => locations.id, { onDelete: "restrict" }),
    eventType: mysqlEnum("eventType", ["time_in", "time_out"]).notNull(),
    note: text("note"),
    recordedById: int("recordedById").notNull().references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("staff_attendance_location_created_idx").on(table.locationId, table.createdAt), index("staff_attendance_user_created_idx").on(table.userId, table.createdAt)],
);

export const categories = mysqlTable("categories", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 120 }).notNull().unique(),
  description: text("description"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const products = mysqlTable(
  "products",
  {
    id: int("id").autoincrement().primaryKey(),
    sku: varchar("sku", { length: 80 }).notNull().unique(),
    name: varchar("name", { length: 180 }).notNull(),
    description: text("description"),
    categoryId: int("categoryId").references(() => categories.id, { onDelete: "set null" }),
    price: decimal("price", { precision: 14, scale: 2 }).notNull(),
    costPrice: decimal("costPrice", { precision: 14, scale: 2 }).default("0").notNull(),
    taxRate: decimal("taxRate", { precision: 6, scale: 4 }).default("0.12").notNull(),
    isTaxInclusive: boolean("isTaxInclusive").default(false).notNull(),
    isActive: boolean("isActive").default(true).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("products_category_active_idx").on(table.categoryId, table.isActive)],
);

export const locationInventory = mysqlTable(
  "locationInventory",
  {
    id: int("id").autoincrement().primaryKey(),
    locationId: int("locationId").notNull().references(() => locations.id, { onDelete: "cascade" }),
    productId: int("productId").notNull().references(() => products.id, { onDelete: "cascade" }),
    quantity: decimal("quantity", { precision: 14, scale: 3 }).default("0").notNull(),
    reservedQuantity: decimal("reservedQuantity", { precision: 14, scale: 3 }).default("0").notNull(),
    lowStockThreshold: decimal("lowStockThreshold", { precision: 14, scale: 3 }).default("0").notNull(),
    reorderQuantity: decimal("reorderQuantity", { precision: 14, scale: 3 }).default("0").notNull(),
    priceOverride: decimal("priceOverride", { precision: 14, scale: 2 }),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("location_inventory_unique").on(table.locationId, table.productId),
    index("location_inventory_low_stock_idx").on(table.locationId, table.quantity, table.lowStockThreshold),
  ],
);

export const purchaseRequests = mysqlTable(
  "purchaseRequests",
  {
    id: int("id").autoincrement().primaryKey(),
    requestNumber: varchar("requestNumber", { length: 48 }).notNull().unique(),
    locationId: int("locationId").notNull().references(() => locations.id, { onDelete: "restrict" }),
    requestedById: int("requestedById").notNull().references(() => users.id, { onDelete: "restrict" }),
    approvedById: int("approvedById").references(() => users.id, { onDelete: "restrict" }),
    status: mysqlEnum("status", ["draft", "submitted", "approved", "rejected", "converted"]).default("draft").notNull(),
    note: text("note"),
    rejectionReason: text("rejectionReason"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    submittedAt: timestamp("submittedAt"),
    approvedAt: timestamp("approvedAt"),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("purchase_requests_location_status_idx").on(table.locationId, table.status)],
);

export const purchaseRequestItems = mysqlTable("purchaseRequestItems", {
  id: int("id").autoincrement().primaryKey(),
  requestId: int("requestId").notNull().references(() => purchaseRequests.id, { onDelete: "cascade" }),
  productId: int("productId").notNull().references(() => products.id, { onDelete: "restrict" }),
  quantityRequested: decimal("quantityRequested", { precision: 14, scale: 3 }).notNull(),
  note: text("note"),
}, table => [index("purchase_request_items_request_idx").on(table.requestId)]);

export const purchaseOrders = mysqlTable(
  "purchaseOrders",
  {
    id: int("id").autoincrement().primaryKey(),
    orderNumber: varchar("orderNumber", { length: 48 }).notNull().unique(),
    locationId: int("locationId").notNull().references(() => locations.id, { onDelete: "restrict" }),
    requestId: int("requestId").references(() => purchaseRequests.id, { onDelete: "set null" }),
    supplierName: varchar("supplierName", { length: 180 }).notNull(),
    createdById: int("createdById").notNull().references(() => users.id, { onDelete: "restrict" }),
    approvedById: int("approvedById").references(() => users.id, { onDelete: "restrict" }),
    status: mysqlEnum("status", ["draft", "submitted", "approved", "ordered", "partially_received", "received", "cancelled"]).default("draft").notNull(),
    note: text("note"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    approvedAt: timestamp("approvedAt"),
    orderedAt: timestamp("orderedAt"),
    receivedAt: timestamp("receivedAt"),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("purchase_orders_location_status_idx").on(table.locationId, table.status)],
);

export const purchaseOrderItems = mysqlTable("purchaseOrderItems", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull().references(() => purchaseOrders.id, { onDelete: "cascade" }),
  productId: int("productId").notNull().references(() => products.id, { onDelete: "restrict" }),
  quantityOrdered: decimal("quantityOrdered", { precision: 14, scale: 3 }).notNull(),
  quantityReceived: decimal("quantityReceived", { precision: 14, scale: 3 }).default("0").notNull(),
  unitCost: decimal("unitCost", { precision: 14, scale: 2 }).default("0").notNull(),
}, table => [index("purchase_order_items_order_idx").on(table.orderId)]);

export const loyaltyMembers = mysqlTable(
  "loyaltyMembers",
  {
    id: int("id").autoincrement().primaryKey(),
    memberNumber: varchar("memberNumber", { length: 48 }).notNull().unique(),
    firstName: varchar("firstName", { length: 100 }).notNull(),
    lastName: varchar("lastName", { length: 100 }).notNull(),
    mobile: varchar("mobile", { length: 32 }).notNull().unique(),
    email: varchar("email", { length: 320 }).unique(),
    passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
    status: mysqlEnum("status", ["active", "suspended", "closed"]).default("active").notNull(),
    joinedLocationId: int("joinedLocationId").references(() => locations.id, { onDelete: "set null" }),
    joinedAt: timestamp("joinedAt").defaultNow().notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("loyalty_members_name_idx").on(table.lastName, table.firstName)],
);

export const loyaltyCards = mysqlTable(
  "loyaltyCards",
  {
    id: int("id").autoincrement().primaryKey(),
    memberId: int("memberId").notNull().references(() => loyaltyMembers.id, { onDelete: "cascade" }),
    cardNumber: varchar("cardNumber", { length: 48 }).notNull().unique(),
    displayToken: varchar("displayToken", { length: 128 }).notNull().unique(),
    cardType: mysqlEnum("cardType", ["digital"]).default("digital").notNull(),
    status: mysqlEnum("status", ["active", "revoked", "expired"]).default("active").notNull(),
    issuedAt: timestamp("issuedAt").defaultNow().notNull(),
    expiresAt: timestamp("expiresAt"),
  },
  table => [index("loyalty_cards_member_status_idx").on(table.memberId, table.status)],
);

export const loyaltyAccounts = mysqlTable("loyaltyAccounts", {
  id: int("id").autoincrement().primaryKey(),
  memberId: int("memberId").notNull().references(() => loyaltyMembers.id, { onDelete: "cascade" }).unique(),
  currentPoints: int("currentPoints").default(0).notNull(),
  lifetimeEarned: int("lifetimeEarned").default(0).notNull(),
  lifetimeRedeemed: int("lifetimeRedeemed").default(0).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const stockTransfers = mysqlTable(
  "stockTransfers",
  {
    id: int("id").autoincrement().primaryKey(),
    transferNumber: varchar("transferNumber", { length: 48 }).notNull().unique(),
    sourceLocationId: int("sourceLocationId").notNull().references(() => locations.id, { onDelete: "restrict" }),
    destinationLocationId: int("destinationLocationId").notNull().references(() => locations.id, { onDelete: "restrict" }),
    status: mysqlEnum("status", ["requested", "shipped", "received", "cancelled"]).default("requested").notNull(),
    requestedById: int("requestedById").notNull().references(() => users.id, { onDelete: "restrict" }),
    shippedById: int("shippedById").references(() => users.id, { onDelete: "restrict" }),
    receivedById: int("receivedById").references(() => users.id, { onDelete: "restrict" }),
    note: text("note"),
    requestedAt: timestamp("requestedAt").defaultNow().notNull(),
    shippedAt: timestamp("shippedAt"),
    receivedAt: timestamp("receivedAt"),
  },
  table => [index("stock_transfers_locations_status_idx").on(table.sourceLocationId, table.destinationLocationId, table.status)],
);

export const stockTransferItems = mysqlTable(
  "stockTransferItems",
  {
    id: int("id").autoincrement().primaryKey(),
    transferId: int("transferId").notNull().references(() => stockTransfers.id, { onDelete: "cascade" }),
    productId: int("productId").notNull().references(() => products.id, { onDelete: "restrict" }),
    quantityRequested: decimal("quantityRequested", { precision: 14, scale: 3 }).notNull(),
    quantityShipped: decimal("quantityShipped", { precision: 14, scale: 3 }).default("0").notNull(),
    quantityReceived: decimal("quantityReceived", { precision: 14, scale: 3 }).default("0").notNull(),
  },
  table => [uniqueIndex("stock_transfer_product_unique").on(table.transferId, table.productId)],
);

export const sales = mysqlTable(
  "sales",
  {
    id: int("id").autoincrement().primaryKey(),
    receiptNumber: varchar("receiptNumber", { length: 48 }).notNull().unique(),
    locationId: int("locationId").notNull().references(() => locations.id, { onDelete: "restrict" }),
    registerId: int("registerId").references(() => registers.id, { onDelete: "set null" }),
    cashSessionId: int("cashSessionId").references(() => cashSessions.id, { onDelete: "set null" }),
    cashierId: int("cashierId").notNull().references(() => users.id, { onDelete: "restrict" }),
    memberId: int("memberId").references(() => loyaltyMembers.id, { onDelete: "set null" }),
    status: mysqlEnum("status", ["completed", "voided"]).default("completed").notNull(),
    subtotal: decimal("subtotal", { precision: 14, scale: 2 }).notNull(),
    taxAmount: decimal("taxAmount", { precision: 14, scale: 2 }).default("0").notNull(),
    discountAmount: decimal("discountAmount", { precision: 14, scale: 2 }).default("0").notNull(),
    totalAmount: decimal("totalAmount", { precision: 14, scale: 2 }).notNull(),
    qualifyingAmount: decimal("qualifyingAmount", { precision: 14, scale: 2 }).default("0").notNull(),
    pointsEarned: int("pointsEarned").default(0).notNull(),
    idempotencyKey: varchar("idempotencyKey", { length: 128 }).notNull().unique(),
    voidedById: int("voidedById").references(() => users.id, { onDelete: "restrict" }),
    voidedAt: timestamp("voidedAt"),
    voidReason: text("voidReason"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("sales_location_created_idx").on(table.locationId, table.createdAt),
    index("sales_member_created_idx").on(table.memberId, table.createdAt),
  ],
);

export const saleItems = mysqlTable(
  "saleItems",
  {
    id: int("id").autoincrement().primaryKey(),
    saleId: int("saleId").notNull().references(() => sales.id, { onDelete: "cascade" }),
    productId: int("productId").references(() => products.id, { onDelete: "set null" }),
    skuSnapshot: varchar("skuSnapshot", { length: 80 }).notNull(),
    nameSnapshot: varchar("nameSnapshot", { length: 180 }).notNull(),
    unitPrice: decimal("unitPrice", { precision: 14, scale: 2 }).notNull(),
    quantity: decimal("quantity", { precision: 14, scale: 3 }).notNull(),
    taxRate: decimal("taxRate", { precision: 6, scale: 4 }).default("0").notNull(),
    taxAmount: decimal("taxAmount", { precision: 14, scale: 2 }).default("0").notNull(),
    lineTotal: decimal("lineTotal", { precision: 14, scale: 2 }).notNull(),
  },
  table => [index("sale_items_sale_idx").on(table.saleId)],
);

export const payments = mysqlTable(
  "payments",
  {
    id: int("id").autoincrement().primaryKey(),
    saleId: int("saleId").notNull().references(() => sales.id, { onDelete: "cascade" }),
    locationId: int("locationId").notNull().references(() => locations.id, { onDelete: "restrict" }),
    method: mysqlEnum("method", ["cash", "gcash", "maya", "qrph", "debit_card", "credit_card", "bank_transfer"]).notNull(),
    provider: varchar("provider", { length: 64 }).default("mock").notNull(),
    status: mysqlEnum("status", ["authorized", "paid", "failed", "cancelled", "refunded"]).default("authorized").notNull(),
    amount: decimal("amount", { precision: 14, scale: 2 }).notNull(),
    amountTendered: decimal("amountTendered", { precision: 14, scale: 2 }),
    changeAmount: decimal("changeAmount", { precision: 14, scale: 2 }).default("0").notNull(),
    reference: varchar("reference", { length: 120 }),
    metadata: json("metadata"),
    processedAt: timestamp("processedAt").defaultNow().notNull(),
  },
  table => [index("payments_sale_idx").on(table.saleId)],
);

export const saleReturns = mysqlTable(
  "saleReturns",
  {
    id: int("id").autoincrement().primaryKey(),
    returnNumber: varchar("returnNumber", { length: 48 }).notNull().unique(),
    saleId: int("saleId").notNull().references(() => sales.id, { onDelete: "restrict" }),
    locationId: int("locationId").notNull().references(() => locations.id, { onDelete: "restrict" }),
    cashSessionId: int("cashSessionId").references(() => cashSessions.id, { onDelete: "set null" }),
    status: mysqlEnum("status", ["completed"]).default("completed").notNull(),
    reasonCode: mysqlEnum("reasonCode", ["customer_change_mind", "damaged", "wrong_item", "pricing_error", "other"]).notNull(),
    reasonNote: text("reasonNote"),
    refundAmount: decimal("refundAmount", { precision: 14, scale: 2 }).notNull(),
    refundMethod: mysqlEnum("refundMethod", ["cash", "gcash", "maya", "qrph", "debit_card", "credit_card", "bank_transfer"]).notNull(),
    exchangeSaleId: int("exchangeSaleId").references(() => sales.id, { onDelete: "restrict" }),
    processedById: int("processedById").notNull().references(() => users.id, { onDelete: "restrict" }),
    approvedById: int("approvedById").notNull().references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("sale_returns_sale_created_idx").on(table.saleId, table.createdAt), index("sale_returns_location_created_idx").on(table.locationId, table.createdAt), uniqueIndex("sale_returns_exchange_sale_unique").on(table.exchangeSaleId)],
);

export const saleReturnItems = mysqlTable(
  "saleReturnItems",
  {
    id: int("id").autoincrement().primaryKey(),
    returnId: int("returnId").notNull().references(() => saleReturns.id, { onDelete: "restrict" }),
    saleItemId: int("saleItemId").notNull().references(() => saleItems.id, { onDelete: "restrict" }),
    productId: int("productId").notNull().references(() => products.id, { onDelete: "restrict" }),
    quantity: decimal("quantity", { precision: 14, scale: 3 }).notNull(),
    refundAmount: decimal("refundAmount", { precision: 14, scale: 2 }).notNull(),
  },
  table => [uniqueIndex("sale_return_item_unique").on(table.returnId, table.saleItemId)],
);

export const returnPayments = mysqlTable(
  "returnPayments",
  {
    id: int("id").autoincrement().primaryKey(),
    returnId: int("returnId").notNull().references(() => saleReturns.id, { onDelete: "restrict" }),
    originalPaymentId: int("originalPaymentId").references(() => payments.id, { onDelete: "set null" }),
    method: mysqlEnum("method", ["cash", "gcash", "maya", "qrph", "debit_card", "credit_card", "bank_transfer"]).notNull(),
    provider: varchar("provider", { length: 64 }).default("mock").notNull(),
    status: mysqlEnum("status", ["refunded"]).default("refunded").notNull(),
    amount: decimal("amount", { precision: 14, scale: 2 }).notNull(),
    reference: varchar("reference", { length: 120 }),
    processedAt: timestamp("processedAt").defaultNow().notNull(),
  },
  table => [index("return_payments_return_idx").on(table.returnId)],
);

export const receipts = mysqlTable("receipts", {
  id: int("id").autoincrement().primaryKey(),
  saleId: int("saleId").notNull().references(() => sales.id, { onDelete: "cascade" }).unique(),
  receiptNumber: varchar("receiptNumber", { length: 48 }).notNull().unique(),
  format: mysqlEnum("format", ["digital"]).default("digital").notNull(),
  content: json("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const fiscalDocuments = mysqlTable(
  "fiscalDocuments",
  {
    id: int("id").autoincrement().primaryKey(),
    invoiceSeriesId: int("invoiceSeriesId").notNull().references(() => invoiceSeries.id, { onDelete: "restrict" }),
    locationId: int("locationId").notNull().references(() => locations.id, { onDelete: "restrict" }),
    saleId: int("saleId").references(() => sales.id, { onDelete: "restrict" }),
    documentNumber: varchar("documentNumber", { length: 96 }).notNull(),
    sequenceNumber: int("sequenceNumber").notNull(),
    status: mysqlEnum("status", ["allocated", "issued", "voided"]).default("allocated").notNull(),
    metadata: json("metadata"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("fiscal_documents_series_number_unique").on(table.invoiceSeriesId, table.documentNumber),
    uniqueIndex("fiscal_documents_sale_unique").on(table.saleId),
    index("fiscal_documents_location_created_idx").on(table.locationId, table.createdAt),
  ],
);

export const stockMovements = mysqlTable(
  "stockMovements",
  {
    id: int("id").autoincrement().primaryKey(),
    locationId: int("locationId").notNull().references(() => locations.id, { onDelete: "restrict" }),
    productId: int("productId").notNull().references(() => products.id, { onDelete: "restrict" }),
    quantityDelta: decimal("quantityDelta", { precision: 14, scale: 3 }).notNull(),
    movementType: mysqlEnum("movementType", ["receiving", "sale", "void", "return", "adjustment", "transfer_shipment", "transfer_receipt"]).notNull(),
    referenceType: varchar("referenceType", { length: 64 }),
    referenceId: int("referenceId"),
    note: text("note"),
    createdById: int("createdById").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("stock_movements_location_product_idx").on(table.locationId, table.productId, table.createdAt)],
);

export const loyaltyTransactions = mysqlTable(
  "loyaltyTransactions",
  {
    id: int("id").autoincrement().primaryKey(),
    memberId: int("memberId").notNull().references(() => loyaltyMembers.id, { onDelete: "restrict" }),
    accountId: int("accountId").notNull().references(() => loyaltyAccounts.id, { onDelete: "restrict" }),
    type: mysqlEnum("type", ["earn", "reversal", "adjustment", "redeem"]).notNull(),
    points: int("points").notNull(),
    balanceAfter: int("balanceAfter").notNull(),
    saleId: int("saleId").references(() => sales.id, { onDelete: "restrict" }),
    locationId: int("locationId").references(() => locations.id, { onDelete: "set null" }),
    referenceId: varchar("referenceId", { length: 96 }),
    note: text("note"),
    createdById: int("createdById").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("loyalty_transactions_member_created_idx").on(table.memberId, table.createdAt),
    index("loyalty_transactions_sale_idx").on(table.saleId),
  ],
);

export const auditLogs = mysqlTable(
  "auditLogs",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").references(() => users.id, { onDelete: "set null" }),
    locationId: int("locationId").references(() => locations.id, { onDelete: "set null" }),
    action: varchar("action", { length: 120 }).notNull(),
    entityType: varchar("entityType", { length: 80 }).notNull(),
    entityId: varchar("entityId", { length: 80 }),
    metadata: json("metadata"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("audit_logs_entity_idx").on(table.entityType, table.entityId, table.createdAt)],
);

export const systemSettings = mysqlTable("systemSettings", {
  id: int("id").autoincrement().primaryKey(),
  key: varchar("key", { length: 100 }).notNull().unique(),
  value: json("value").notNull(),
  updatedById: int("updatedById").references(() => users.id, { onDelete: "set null" }),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const reportTemplates = mysqlTable(
  "reportTemplates",
  {
    id: int("id").autoincrement().primaryKey(),
    ownerId: int("ownerId").notNull().references(() => users.id, { onDelete: "cascade" }),
    locationId: int("locationId").references(() => locations.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    metric: mysqlEnum("metric", ["revenue", "transactions", "products"]).notNull(),
    groupBy: mysqlEnum("groupBy", ["products", "locations"]).notNull(),
    presentation: mysqlEnum("presentation", ["bars", "table"]).notNull(),
    startDate: timestamp("startDate"),
    endDate: timestamp("endDate"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("report_templates_owner_idx").on(table.ownerId, table.updatedAt), index("report_templates_location_idx").on(table.locationId)],
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
