import { describe, expect, it, vi } from "vitest";
import { receipts, sales, stockMovements } from "../drizzle/schema";

const dbMocks = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("./db", () => dbMocks);

import { completeCheckout, voidCompletedSale } from "./checkoutService";

type InsertedRow = { table: unknown; values: unknown };

function createCheckoutDb(selectResults: unknown[][]) {
  const inserted: InsertedRow[] = [];
  let selectIndex = 0;
  const transactionDb: any = {
    select: () => {
      const result = selectResults[selectIndex++] ?? [];
      const chain: any = {
        from: () => chain, innerJoin: () => chain, where: () => chain, orderBy: () => chain, for: () => chain, limit: () => chain,
        then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(result).then(resolve, reject),
      };
      return chain;
    },
    insert: (table: unknown) => ({
      values: (values: unknown) => {
        inserted.push({ table, values });
        const result = [{ insertId: table === sales ? 91 : inserted.length + 100 }];
        return {
          onDuplicateKeyUpdate: async () => result,
          then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(result).then(resolve, reject),
        };
      },
    }),
    update: () => {
      const chain: any = { set: () => chain, where: async () => [{ affectedRows: 1 }] };
      return chain;
    },
  };
  const rootDb: any = {
    select: () => {
      const chain: any = { from: () => chain, where: () => chain, limit: async () => [] };
      return chain;
    },
    transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback(transactionDb),
  };
  return { rootDb, inserted };
}

function checkoutSelectResults() {
  return [
    [{ id: 3, code: "MNL-01", name: "Manila Store", isActive: true }],
    [{ id: 4, code: "POS-01", name: "Counter 1", isActive: true }],
    [{ id: 8, status: "open", registerId: 4 }],
    [{ inventoryQuantity: "10.000", priceOverride: null, productId: 9, sku: "SKU-9", name: "Coffee", price: "100.00", taxRate: "0.12", isTaxInclusive: false, isActive: true }],
    [{ id: 44, name: "Ana Santos", email: "ana@example.com", isActive: true }],
  ];
}

describe("checkout service transaction behavior", () => {
  it("persists a receipt containing cashier, totals, tax, payment, and loyalty fields", async () => {
    const selectResults = checkoutSelectResults();
    selectResults.push(
      [{ id: 22, memberNumber: "M-000022", firstName: "Mia", lastName: "Reyes", status: "active" }],
      [{ id: 51, currentPoints: 12 }],
    );
    const { rootDb, inserted } = createCheckoutDb(selectResults);
    dbMocks.getDb.mockResolvedValue(rootDb);

    await completeCheckout({
      locationId: 3, registerId: 4, cashSessionId: 8, cashierId: 44, memberId: 22, paymentMethod: "cash", amountTendered: "120.00",
      discountAmount: "10.00", idempotencyKey: "receipt-transaction-test-0001", lines: [{ productId: 9, quantity: "1" }],
    });

    const persistedReceipt = inserted.find(entry => entry.table === receipts)?.values as { content?: Record<string, any> } | undefined;
    expect(persistedReceipt?.content).toMatchObject({
      cashier: { id: 44, name: "Ana Santos", email: "ana@example.com" },
      member: { id: 22, memberNumber: "M-000022", name: "Mia Reyes" },
      subtotal: "90.00", discountAmount: "10.00", taxAmount: "10.80", totalAmount: "100.80",
      taxBreakdown: [{ taxRate: "0.12", taxAmount: "10.80" }],
      payment: { method: "cash", amountTendered: "120.00", changeAmount: "19.20" },
      loyalty: { pointsEarned: 0, pointsBalance: 12 },
    });
    expect(inserted.find(entry => entry.table === stockMovements)?.values).toMatchObject({ movementType: "sale", quantityDelta: "-1", referenceId: 91 });
  });

  it("rolls back a failed non-cash mock payment before any sale, receipt, inventory, or loyalty write", async () => {
    const { rootDb, inserted } = createCheckoutDb(checkoutSelectResults());
    dbMocks.getDb.mockResolvedValue(rootDb);

    await expect(completeCheckout({
      locationId: 3, registerId: 4, cashSessionId: 8, cashierId: 44, paymentMethod: "gcash", mockPaymentOutcome: "failed",
      idempotencyKey: "failed-payment-test-0001", lines: [{ productId: 9, quantity: "1" }],
    })).rejects.toThrow("Mock gcash payment failed");
    expect(inserted).toEqual([]);
  });

  it("appends a positive stock movement when a completed sale is voided", async () => {
    const { rootDb, inserted } = createCheckoutDb([
      [{ id: 91, status: "completed", locationId: 3, cashSessionId: 8, totalAmount: "100.80", memberId: null, pointsEarned: 0, receiptNumber: "RCPT-91" }],
      [{ productId: 9, quantity: "1" }],
      [{ method: "cash" }],
    ]);
    dbMocks.getDb.mockResolvedValue(rootDb);

    await expect(voidCompletedSale({ saleId: 91, voidedById: 44, reason: "Customer cancellation" })).resolves.toEqual({ success: true, saleId: 91 });
    expect(inserted.find(entry => entry.table === stockMovements)?.values).toMatchObject({
      locationId: 3, productId: 9, quantityDelta: "1", movementType: "void", referenceType: "sale_void", referenceId: 91,
    });
  });
});
