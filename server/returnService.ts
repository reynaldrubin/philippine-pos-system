import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { cashSessions, locationInventory, payments, registers, returnPayments, saleItems, saleReturnItems, saleReturns, sales, stockMovements } from "../drizzle/schema";
import { centavosToDecimal, decimalToCentavos, type PaymentMethod } from "./checkoutRules";
import { getDb } from "./db";
import { calculatePartialRefund } from "./returnRules";

export type PartialReturnInput = {
  saleId: number;
  cashSessionId?: number;
  reasonCode: "customer_change_mind" | "damaged" | "wrong_item" | "pricing_error" | "other";
  reasonNote?: string;
  refundMethod: PaymentMethod;
  processedById: number;
  approvedById: number;
  items: Array<{ saleItemId: number; quantity: string }>;
};

export async function processPartialReturn(input: PartialReturnInput) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  return db.transaction(async tx => {
    const saleRows = await tx.select({ id: sales.id, locationId: sales.locationId, status: sales.status }).from(sales).where(eq(sales.id, input.saleId)).limit(1).for("update");
    const sale = saleRows[0];
    if (!sale || sale.status !== "completed") throw new Error("Only a completed sale can be partially returned");
    if (input.refundMethod === "cash" && !input.cashSessionId) throw new Error("An open cash session is required for a cash refund");
    if (input.refundMethod !== "cash" && input.cashSessionId) throw new Error("Only cash refunds may use a cash session");

    const sourceItems = await tx.select({ id: saleItems.id, productId: saleItems.productId, quantity: saleItems.quantity, lineTotal: saleItems.lineTotal })
      .from(saleItems).where(eq(saleItems.saleId, input.saleId));
    const priorReturns = await tx.select({ saleItemId: saleReturnItems.saleItemId, quantity: saleReturnItems.quantity })
      .from(saleReturnItems).innerJoin(saleReturns, eq(saleReturnItems.returnId, saleReturns.id)).where(eq(saleReturns.saleId, input.saleId));
    const priorByItem = new Map<number, number>();
    priorReturns.forEach(item => priorByItem.set(item.saleItemId, (priorByItem.get(item.saleItemId) ?? 0) + Number(item.quantity)));
    const requestedIds = new Set<number>();
    const returnLines = input.items.map(request => {
      if (requestedIds.has(request.saleItemId)) throw new Error("Duplicate return lines must be combined");
      requestedIds.add(request.saleItemId);
      const source = sourceItems.find(item => item.id === request.saleItemId);
      if (!source || !source.productId) throw new Error("A return line is not available from the original sale");
      const refundAmount = calculatePartialRefund({ soldQuantity: String(source.quantity), alreadyReturnedQuantity: String(priorByItem.get(source.id) ?? 0), requestedQuantity: request.quantity, lineTotal: String(source.lineTotal) });
      return { saleItemId: source.id, productId: source.productId, quantity: request.quantity, refundAmount };
    });
    if (!returnLines.length) throw new Error("At least one return line is required");
    const refundAmount = centavosToDecimal(returnLines.reduce((total, line) => total + decimalToCentavos(line.refundAmount), 0));

    if (input.refundMethod === "cash") {
      const sessionRows = await tx.select({ id: cashSessions.id, status: cashSessions.status, locationId: registers.locationId, expectedCash: cashSessions.expectedCash })
        .from(cashSessions).innerJoin(registers, eq(cashSessions.registerId, registers.id)).where(eq(cashSessions.id, input.cashSessionId!)).limit(1).for("update");
      const session = sessionRows[0];
      if (!session || session.status !== "open" || session.locationId !== sale.locationId) throw new Error("Cash refund session must be open at the original sale location");
      if (decimalToCentavos(String(session.expectedCash)) < decimalToCentavos(refundAmount)) throw new Error("Cash session does not have sufficient expected cash for this refund");
    }

    const returnNumber = `RET-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`;
    const [returnResult] = await tx.insert(saleReturns).values({
      returnNumber, saleId: sale.id, locationId: sale.locationId, cashSessionId: input.cashSessionId ?? null, reasonCode: input.reasonCode,
      reasonNote: input.reasonNote?.trim() || null, refundAmount, refundMethod: input.refundMethod, processedById: input.processedById, approvedById: input.approvedById,
    });
    const returnId = Number(returnResult.insertId);
    await tx.insert(saleReturnItems).values(returnLines.map(line => ({ returnId, ...line })));
    for (const line of returnLines) {
      await tx.update(locationInventory).set({ quantity: sql`${locationInventory.quantity} + ${line.quantity}` }).where(and(eq(locationInventory.locationId, sale.locationId), eq(locationInventory.productId, line.productId)));
      await tx.insert(stockMovements).values({ locationId: sale.locationId, productId: line.productId, quantityDelta: line.quantity, movementType: "return", referenceType: "sale_return", referenceId: returnId, note: input.reasonCode, createdById: input.processedById });
    }
    const originalPayment = await tx.select({ id: payments.id, provider: payments.provider, reference: payments.reference }).from(payments).where(and(eq(payments.saleId, sale.id), eq(payments.status, "paid"))).limit(1);
    await tx.insert(returnPayments).values({ returnId, originalPaymentId: originalPayment[0]?.id ?? null, method: input.refundMethod, provider: originalPayment[0]?.provider ?? "mock", amount: refundAmount, reference: `REF-${returnNumber}` });
    if (input.refundMethod === "cash") await tx.update(cashSessions).set({ expectedCash: sql`${cashSessions.expectedCash} - ${refundAmount}` }).where(and(eq(cashSessions.id, input.cashSessionId!), eq(cashSessions.status, "open")));
    return { returnId, returnNumber, locationId: sale.locationId, refundAmount };
  });
}

export async function getReturnableSale(saleId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  const saleRows = await db.select({ id: sales.id, receiptNumber: sales.receiptNumber, locationId: sales.locationId, status: sales.status, totalAmount: sales.totalAmount, createdAt: sales.createdAt })
    .from(sales).where(eq(sales.id, saleId)).limit(1);
  const sale = saleRows[0];
  if (!sale) return undefined;
  const sourceItems = await db.select({ id: saleItems.id, productId: saleItems.productId, skuSnapshot: saleItems.skuSnapshot, nameSnapshot: saleItems.nameSnapshot, quantity: saleItems.quantity, lineTotal: saleItems.lineTotal })
    .from(saleItems).where(eq(saleItems.saleId, saleId));
  const priorReturns = await db.select({ saleItemId: saleReturnItems.saleItemId, quantity: saleReturnItems.quantity })
    .from(saleReturnItems).innerJoin(saleReturns, eq(saleReturnItems.returnId, saleReturns.id)).where(eq(saleReturns.saleId, saleId));
  const returnedByItem = new Map<number, number>();
  priorReturns.forEach(item => returnedByItem.set(item.saleItemId, (returnedByItem.get(item.saleItemId) ?? 0) + Number(item.quantity)));
  return { ...sale, items: sourceItems.map(item => ({ ...item, returnedQuantity: String(returnedByItem.get(item.id) ?? 0), availableQuantity: String(Number(item.quantity) - (returnedByItem.get(item.id) ?? 0)) })) };
}
