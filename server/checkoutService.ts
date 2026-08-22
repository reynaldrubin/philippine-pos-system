import { randomUUID } from "node:crypto";
import { and, eq, gte, sql } from "drizzle-orm";
import {
  cashSessions,
  locationInventory,
  locations,
  loyaltyAccounts,
  loyaltyMembers,
  loyaltyTransactions,
  payments,
  products,
  receipts,
  registers,
  saleItems,
  sales,
  stockMovements,
  users,
} from "../drizzle/schema";
import {
  allocateProportionalDiscount,
  calculateCheckoutLoyalty,
  calculateLineAmounts,
  calculateMockPayment,
  centavosToDecimal,
  decimalToCentavos,
  millisToQuantity,
  PaymentMethod,
  quantityToMillis,
  taxRateToBasisPoints,
} from "./checkoutRules";
import { getDb } from "./db";

export type CheckoutRequest = {
  locationId: number;
  registerId: number;
  cashSessionId: number;
  cashierId: number;
  memberId?: number;
  paymentMethod: PaymentMethod;
  amountTendered?: string;
  paymentReference?: string;
  discountAmount?: string;
  mockPaymentOutcome?: "success" | "failed";
  idempotencyKey: string;
  lines: Array<{ productId: number; quantity: string }>;
};

type QuotedLine = {
  productId: number;
  sku: string;
  name: string;
  unitPriceCentavos: number;
  quantityMillis: number;
  quantity: string;
  taxRate: string;
  taxBasisPoints: number;
  discountCentavos: number;
  netCentavos: number;
  taxCentavos: number;
  totalCentavos: number;
};

type CheckoutQuote = {
  lines: QuotedLine[];
  subtotalCentavos: number;
  taxCentavos: number;
  totalCentavos: number;
  discountCentavos: number;
  qualifyingCentavos: number;
  pointsEarned: number;
};

export function composeReceiptIdentity(input: {
  location: { code: string; name: string };
  register: { code: string; name: string };
  cashier: { id: number; name: string | null; email: string | null };
}) {
  return {
    store: { code: input.location.code, name: input.location.name },
    register: { code: input.register.code, name: input.register.name },
    cashier: { id: input.cashier.id, name: input.cashier.name, email: input.cashier.email },
  };
}

async function buildQuote(db: any, input: Pick<CheckoutRequest, "locationId" | "lines">): Promise<CheckoutQuote> {
  const lines: QuotedLine[] = [];
  for (const requested of input.lines) {
    const quantityMillis = quantityToMillis(requested.quantity);
    const inventoryProduct = await db.select({
      inventoryQuantity: locationInventory.quantity,
      priceOverride: locationInventory.priceOverride,
      productId: products.id,
      sku: products.sku,
      name: products.name,
      price: products.price,
      taxRate: products.taxRate,
      isTaxInclusive: products.isTaxInclusive,
      isActive: products.isActive,
    }).from(locationInventory).innerJoin(products, eq(locationInventory.productId, products.id))
      .where(and(eq(locationInventory.locationId, input.locationId), eq(locationInventory.productId, requested.productId))).limit(1);
    const product = inventoryProduct[0];
    if (!product || !product.isActive) throw new Error("A cart product is not available at the selected location");
    if (quantityToMillis(String(product.inventoryQuantity)) < quantityMillis) throw new Error(`Insufficient stock for SKU ${product.sku}`);

    const unitPriceCentavos = decimalToCentavos(String(product.priceOverride ?? product.price));
    const taxRate = String(product.taxRate);
    const amounts = calculateLineAmounts({
      unitPriceCentavos, quantityMillis, taxBasisPoints: taxRateToBasisPoints(taxRate), isTaxInclusive: product.isTaxInclusive,
    });
    lines.push({
      productId: product.productId, sku: product.sku, name: product.name, unitPriceCentavos, quantityMillis,
      quantity: millisToQuantity(quantityMillis), taxRate, taxBasisPoints: taxRateToBasisPoints(taxRate), discountCentavos: 0, ...amounts,
    });
  }
  const subtotalCentavos = lines.reduce((total, line) => total + line.netCentavos, 0);
  const taxCentavos = lines.reduce((total, line) => total + line.taxCentavos, 0);
  const totalCentavos = lines.reduce((total, line) => total + line.totalCentavos, 0);
  return {
    lines, subtotalCentavos, taxCentavos, totalCentavos, discountCentavos: 0, qualifyingCentavos: subtotalCentavos,
    pointsEarned: calculateCheckoutLoyalty(subtotalCentavos),
  };
}

function applyDiscount(quote: CheckoutQuote, discountAmount?: string): CheckoutQuote {
  const discountCentavos = discountAmount ? decimalToCentavos(discountAmount) : 0;
  if (discountCentavos === 0) return quote;
  if (discountCentavos > quote.subtotalCentavos) throw new Error("Discount cannot exceed the pre-tax merchandise subtotal");
  const allocations = allocateProportionalDiscount(quote.lines.map(line => line.netCentavos), discountCentavos);
  const discountedLines = quote.lines.map((line, index) => {
    const allocatedDiscount = allocations[index] ?? 0;
    const netCentavos = line.netCentavos - allocatedDiscount;
    const taxCentavos = Math.round((netCentavos * line.taxBasisPoints) / 10_000);
    return { ...line, discountCentavos: allocatedDiscount, netCentavos, taxCentavos, totalCentavos: netCentavos + taxCentavos };
  });
  const subtotalCentavos = discountedLines.reduce((total, line) => total + line.netCentavos, 0);
  const taxCentavos = discountedLines.reduce((total, line) => total + line.taxCentavos, 0);
  return {
    lines: discountedLines, subtotalCentavos, taxCentavos, totalCentavos: subtotalCentavos + taxCentavos, discountCentavos,
    qualifyingCentavos: subtotalCentavos, pointsEarned: calculateCheckoutLoyalty(subtotalCentavos),
  };
}

function serializeQuote(quote: CheckoutQuote) {
  const taxByRate = new Map<string, number>();
  quote.lines.forEach(line => taxByRate.set(line.taxRate, (taxByRate.get(line.taxRate) ?? 0) + line.taxCentavos));
  return {
    lines: quote.lines.map(line => ({
      productId: line.productId, sku: line.sku, name: line.name, unitPrice: centavosToDecimal(line.unitPriceCentavos),
      quantity: line.quantity, taxRate: line.taxRate, discountAmount: centavosToDecimal(line.discountCentavos), netAmount: centavosToDecimal(line.netCentavos),
      taxAmount: centavosToDecimal(line.taxCentavos), totalAmount: centavosToDecimal(line.totalCentavos),
    })),
    subtotal: centavosToDecimal(quote.subtotalCentavos), taxAmount: centavosToDecimal(quote.taxCentavos),
    discountAmount: centavosToDecimal(quote.discountCentavos), totalAmount: centavosToDecimal(quote.totalCentavos), qualifyingAmount: centavosToDecimal(quote.qualifyingCentavos),
    projectedPoints: quote.pointsEarned,
    taxBreakdown: Array.from(taxByRate.entries()).map(([taxRate, taxCentavos]) => ({ taxRate, taxAmount: centavosToDecimal(taxCentavos) })),
  };
}

export async function quoteCheckout(input: Pick<CheckoutRequest, "locationId" | "memberId" | "lines" | "discountAmount">) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  const quote = applyDiscount(await buildQuote(db, input), input.discountAmount);
  if (input.memberId) {
    const member = await db.select({ id: loyaltyMembers.id, status: loyaltyMembers.status }).from(loyaltyMembers).where(eq(loyaltyMembers.id, input.memberId)).limit(1);
    if (!member[0] || member[0].status !== "active") throw new Error("Selected loyalty member is not active");
  }
  return serializeQuote(quote);
}

export async function completeCheckout(input: CheckoutRequest) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");

  const existingSale = await db.select({ id: sales.id, receiptNumber: sales.receiptNumber }).from(sales).where(eq(sales.idempotencyKey, input.idempotencyKey)).limit(1);
  if (existingSale[0]) return { saleId: existingSale[0].id, receiptNumber: existingSale[0].receiptNumber, replayed: true };

  return db.transaction(async tx => {
    const location = await tx.select({ id: locations.id, code: locations.code, name: locations.name, isActive: locations.isActive })
      .from(locations).where(eq(locations.id, input.locationId)).limit(1);
    if (!location[0] || !location[0].isActive) throw new Error("Selected location is not active");

    const register = await tx.select({ id: registers.id, code: registers.code, name: registers.name, isActive: registers.isActive })
      .from(registers).where(and(eq(registers.id, input.registerId), eq(registers.locationId, input.locationId))).limit(1);
    if (!register[0] || !register[0].isActive) throw new Error("Selected register is not active at this location");

    const session = await tx.select({ id: cashSessions.id, status: cashSessions.status, registerId: cashSessions.registerId })
      .from(cashSessions).where(eq(cashSessions.id, input.cashSessionId)).limit(1);
    if (!session[0] || session[0].status !== "open" || session[0].registerId !== input.registerId) throw new Error("An open cash session is required for this register");

    const quote = applyDiscount(await buildQuote(tx, input), input.discountAmount);
    const cashier = await tx.select({ id: users.id, name: users.name, email: users.email, isActive: users.isActive }).from(users).where(eq(users.id, input.cashierId)).limit(1);
    if (!cashier[0] || !cashier[0].isActive) throw new Error("Cashier account is unavailable");
    let memberAccount: { id: number; currentPoints: number } | undefined;
    let receiptMember: { id: number; memberNumber: string; firstName: string; lastName: string } | undefined;
    if (input.memberId) {
      const member = await tx.select({ id: loyaltyMembers.id, memberNumber: loyaltyMembers.memberNumber, firstName: loyaltyMembers.firstName, lastName: loyaltyMembers.lastName, status: loyaltyMembers.status }).from(loyaltyMembers).where(eq(loyaltyMembers.id, input.memberId)).limit(1);
      if (!member[0] || member[0].status !== "active") throw new Error("Selected loyalty member is not active");
      receiptMember = member[0];
      const account = await tx.select({ id: loyaltyAccounts.id, currentPoints: loyaltyAccounts.currentPoints }).from(loyaltyAccounts)
        .where(eq(loyaltyAccounts.memberId, input.memberId)).limit(1);
      if (!account[0]) throw new Error("Loyalty account is unavailable");
      memberAccount = account[0];
    }

    const payment = calculateMockPayment({
      method: input.paymentMethod, totalCentavos: quote.totalCentavos,
      tenderedCentavos: input.amountTendered ? decimalToCentavos(input.amountTendered) : undefined, outcome: input.mockPaymentOutcome,
    });
    if (payment.status === "failed") throw new Error(`Mock ${input.paymentMethod} payment failed; no sale was recorded`);
    const receiptNumber = `RCPT-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`;
    const [saleResult] = await tx.insert(sales).values({
      receiptNumber, locationId: input.locationId, registerId: input.registerId, cashSessionId: input.cashSessionId,
      cashierId: input.cashierId, memberId: input.memberId ?? null, subtotal: centavosToDecimal(quote.subtotalCentavos),
      taxAmount: centavosToDecimal(quote.taxCentavos), discountAmount: centavosToDecimal(quote.discountCentavos), totalAmount: centavosToDecimal(quote.totalCentavos),
      qualifyingAmount: centavosToDecimal(quote.qualifyingCentavos), pointsEarned: input.memberId ? quote.pointsEarned : 0, idempotencyKey: input.idempotencyKey,
    });
    const saleId = Number(saleResult.insertId);

    for (const line of quote.lines) {
      const [inventoryResult] = await tx.update(locationInventory).set({ quantity: sql`${locationInventory.quantity} - ${line.quantity}` })
        .where(and(eq(locationInventory.locationId, input.locationId), eq(locationInventory.productId, line.productId), gte(locationInventory.quantity, line.quantity)));
      if (Number(inventoryResult.affectedRows) !== 1) throw new Error(`Insufficient stock for SKU ${line.sku}`);
      await tx.insert(saleItems).values({
        saleId, productId: line.productId, skuSnapshot: line.sku, nameSnapshot: line.name, unitPrice: centavosToDecimal(line.unitPriceCentavos),
        quantity: line.quantity, taxRate: line.taxRate, taxAmount: centavosToDecimal(line.taxCentavos), lineTotal: centavosToDecimal(line.totalCentavos),
      });
      await tx.insert(stockMovements).values({
        locationId: input.locationId, productId: line.productId, quantityDelta: `-${line.quantity}`, movementType: "sale",
        referenceType: "sale", referenceId: saleId, createdById: input.cashierId,
      });
    }

    const reference = input.paymentReference?.trim() || `MOCK-${input.paymentMethod.toUpperCase()}-${randomUUID().slice(0, 8).toUpperCase()}`;
    await tx.insert(payments).values({
      saleId, locationId: input.locationId, method: input.paymentMethod, provider: "mock", status: "paid",
      amount: centavosToDecimal(quote.totalCentavos), amountTendered: centavosToDecimal(payment.amountTenderedCentavos),
      changeAmount: centavosToDecimal(payment.changeCentavos), reference,
      metadata: { processor: "mock", method: input.paymentMethod },
    });
    if (input.paymentMethod === "cash") {
      await tx.update(cashSessions).set({ expectedCash: sql`${cashSessions.expectedCash} + ${centavosToDecimal(quote.totalCentavos)}` })
        .where(eq(cashSessions.id, input.cashSessionId));
    }

    let pointsBalance = memberAccount?.currentPoints ?? 0;
    if (memberAccount && quote.pointsEarned > 0 && input.memberId) {
      pointsBalance += quote.pointsEarned;
      await tx.update(loyaltyAccounts).set({
        currentPoints: pointsBalance, lifetimeEarned: sql`${loyaltyAccounts.lifetimeEarned} + ${quote.pointsEarned}`,
      }).where(eq(loyaltyAccounts.id, memberAccount.id));
      await tx.insert(loyaltyTransactions).values({
        memberId: input.memberId, accountId: memberAccount.id, type: "earn", points: quote.pointsEarned, balanceAfter: pointsBalance,
        saleId, locationId: input.locationId, referenceId: receiptNumber, note: "Points earned from completed sale", createdById: input.cashierId,
      });
    }

    const receiptContent = {
      receiptNumber, issuedAt: new Date().toISOString(), currency: "PHP", ...composeReceiptIdentity({ location: location[0], register: register[0], cashier: cashier[0] }), saleId, memberId: input.memberId ?? null,
      member: receiptMember ? { id: receiptMember.id, memberNumber: receiptMember.memberNumber, name: `${receiptMember.firstName} ${receiptMember.lastName}` } : null,
      ...serializeQuote(quote), payment: {
        method: input.paymentMethod, amountTendered: centavosToDecimal(payment.amountTenderedCentavos), changeAmount: centavosToDecimal(payment.changeCentavos), reference,
      }, loyalty: { pointsEarned: input.memberId ? quote.pointsEarned : 0, pointsBalance },
    };
    await tx.insert(receipts).values({ saleId, receiptNumber, content: receiptContent });
    return { saleId, receiptNumber, replayed: false, receipt: receiptContent };
  });
}

export async function getSaleAccessInfo(saleId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  const result = await db.select({ id: sales.id, locationId: sales.locationId, status: sales.status, receiptNumber: sales.receiptNumber })
    .from(sales).where(eq(sales.id, saleId)).limit(1);
  return result[0];
}

export async function getDigitalReceipt(receiptNumber: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  const result = await db.select({
    saleId: sales.id, locationId: sales.locationId, status: sales.status, receiptNumber: receipts.receiptNumber, content: receipts.content,
  }).from(receipts).innerJoin(sales, eq(receipts.saleId, sales.id)).where(eq(receipts.receiptNumber, receiptNumber)).limit(1);
  return result[0];
}

export async function voidCompletedSale(input: { saleId: number; voidedById: number; reason: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  return db.transaction(async tx => {
    const sale = await tx.select().from(sales).where(eq(sales.id, input.saleId)).limit(1);
    if (!sale[0] || sale[0].status !== "completed") throw new Error("Only completed sales can be voided");
    const saleRecord = sale[0];
    const items = await tx.select().from(saleItems).where(eq(saleItems.saleId, input.saleId));
    for (const item of items) {
      if (!item.productId) continue;
      await tx.insert(locationInventory).values({ locationId: saleRecord.locationId, productId: item.productId, quantity: item.quantity })
        .onDuplicateKeyUpdate({ set: { quantity: sql`${locationInventory.quantity} + ${item.quantity}` } });
      await tx.insert(stockMovements).values({
        locationId: saleRecord.locationId, productId: item.productId, quantityDelta: item.quantity, movementType: "void",
        referenceType: "sale_void", referenceId: input.saleId, note: input.reason.trim(), createdById: input.voidedById,
      });
    }
    if (saleRecord.memberId && saleRecord.pointsEarned > 0) {
      const account = await tx.select().from(loyaltyAccounts).where(eq(loyaltyAccounts.memberId, saleRecord.memberId)).limit(1);
      if (!account[0]) throw new Error("Loyalty account is unavailable for reversal");
      const balanceAfter = account[0].currentPoints - saleRecord.pointsEarned;
      await tx.update(loyaltyAccounts).set({ currentPoints: balanceAfter }).where(eq(loyaltyAccounts.id, account[0].id));
      await tx.insert(loyaltyTransactions).values({
        memberId: saleRecord.memberId, accountId: account[0].id, type: "reversal", points: -saleRecord.pointsEarned, balanceAfter,
        saleId: saleRecord.id, locationId: saleRecord.locationId, referenceId: saleRecord.receiptNumber, note: input.reason.trim(), createdById: input.voidedById,
      });
    }
    await tx.update(sales).set({ status: "voided", voidedById: input.voidedById, voidedAt: new Date(), voidReason: input.reason.trim() }).where(eq(sales.id, input.saleId));
    const payment = await tx.select({ method: payments.method }).from(payments).where(eq(payments.saleId, input.saleId)).limit(1);
    if (payment[0]?.method === "cash" && saleRecord.cashSessionId) {
      await tx.update(cashSessions).set({ expectedCash: sql`${cashSessions.expectedCash} - ${saleRecord.totalAmount}` })
        .where(eq(cashSessions.id, saleRecord.cashSessionId));
    }
    await tx.update(payments).set({ status: "refunded" }).where(eq(payments.saleId, input.saleId));
    return { success: true, saleId: input.saleId };
  });
}
