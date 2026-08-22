import { describe, expect, it } from "vitest";
import { cashSessions, locationInventory, loyaltyAccounts, loyaltyTransactions, payments, sales, stockMovements } from "../drizzle/schema";
import { applyCompletedSaleVoidWritesInTransaction } from "./checkoutService";

function writeTrackingTransaction() {
  const writes: Array<{ kind: "update" | "insert"; table: unknown; values: any }> = [];
  const tx = {
    update: (table: unknown) => ({ set: (values: any) => ({ where: async () => { writes.push({ kind: "update", table, values }); return [{ affectedRows: 1 }]; } }) }),
    insert: (table: unknown) => ({ values: (values: any) => {
      writes.push({ kind: "insert", table, values });
      return table === locationInventory ? { onDuplicateKeyUpdate: async () => undefined } : Promise.resolve(undefined);
    } }),
  };
  return { tx, writes };
}

describe("completed-sale void writes", () => {
  const sale = { id: 41, status: "completed", locationId: 2, cashSessionId: 8, memberId: 6, pointsEarned: 10, totalAmount: "112.00", receiptNumber: "RCPT-41" };

  it("restores stock, appends a void movement and loyalty reversal, refunds payment, and voids the sale", async () => {
    const { tx, writes } = writeTrackingTransaction();
    await expect(applyCompletedSaleVoidWritesInTransaction(tx, { sale, items: [{ productId: 9, quantity: "2" }], account: { id: 5, currentPoints: 22 }, paymentMethod: "cash", voidedById: 13, reason: "Customer return" })).resolves.toEqual({ success: true, saleId: 41 });
    expect(writes).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "insert", table: locationInventory, values: expect.objectContaining({ locationId: 2, productId: 9, quantity: "2" }) }),
      expect.objectContaining({ kind: "insert", table: stockMovements, values: expect.objectContaining({ movementType: "void", quantityDelta: "2", referenceId: 41 }) }),
      expect.objectContaining({ kind: "update", table: loyaltyAccounts, values: { currentPoints: 12 } }),
      expect.objectContaining({ kind: "insert", table: loyaltyTransactions, values: expect.objectContaining({ type: "reversal", points: -10, balanceAfter: 12, saleId: 41 }) }),
      expect.objectContaining({ kind: "update", table: sales, values: expect.objectContaining({ status: "voided", voidedById: 13, voidReason: "Customer return" }) }),
      expect.objectContaining({ kind: "update", table: cashSessions }),
      expect.objectContaining({ kind: "update", table: payments, values: { status: "refunded" } }),
    ]));
  });

  it("rejects non-completed sales before any stock, loyalty, payment, or sale writes", async () => {
    const { tx, writes } = writeTrackingTransaction();
    await expect(applyCompletedSaleVoidWritesInTransaction(tx, { sale: { ...sale, status: "voided" }, items: [], voidedById: 13, reason: "Duplicate" })).rejects.toThrow("Only completed sales can be voided");
    expect(writes).toHaveLength(0);
  });
});
