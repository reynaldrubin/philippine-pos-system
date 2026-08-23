import { saleReturns } from "../drizzle/schema";
import { describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("./db", () => dbMocks);

import { completeCheckout, quoteCheckout } from "./checkoutService";
import { processPartialReturn } from "./returnService";
import { createExchangeHandoffHref, parseExchangeHandoff } from "../shared/exchangeHandoff";

function queryChain(result: unknown) { const chain: any = { from: () => chain, innerJoin: () => chain, where: () => chain, orderBy: () => chain, limit: () => chain, for: () => chain, then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(result).then(resolve, reject) }; return chain; }

describe("guided exchange workflow integration", () => {
  it("creates an immutable refund, then links the same-location replacement checkout to that return", async () => {
    const inserted: Array<{ table: unknown; values: unknown }> = [];
    const updates: Array<{ table: unknown; values: unknown }> = [];
    let transactionIndex = 0;
    let rootSelectIndex = 0;
    const returnSelects = [
      [{ id: 91, locationId: 3, status: "completed" }],
      [{ id: 22, productId: 9, quantity: "2", lineTotal: "200.00" }], [],
      [{ id: 8, status: "open", locationId: 3, expectedCash: "500.00" }],
      [{ id: 66, provider: "mock", reference: "PAY-66" }],
    ];
    const checkoutSelects = [
      [{ id: 3, code: "MNL-01", name: "Manila Store", isActive: true }], [{ id: 4, code: "POS-01", name: "Counter 1", isActive: true }], [{ id: 8, status: "open", registerId: 4 }],
      [{ id: 301, locationId: 3, status: "completed", exchangeSaleId: null }], [{ inventoryQuantity: "10.000", priceOverride: null, productId: 9, sku: "SKU-9", name: "Coffee", price: "100.00", taxRate: "0.12", isTaxInclusive: false, isActive: true }],
      [{ id: 44, name: "Ana Santos", email: "ana@example.com", isActive: true }], [],
    ];
    const rootDb: any = {
      select: () => queryChain(([[{ inventoryQuantity: "10.000", priceOverride: null, productId: 9, sku: "SKU-9", name: "Coffee", price: "100.00", taxRate: "0.12", isTaxInclusive: false, isActive: true }], []][rootSelectIndex++] ?? [])),
      transaction: async (callback: (tx: any) => Promise<unknown>) => {
        const selects = transactionIndex++ === 0 ? returnSelects : checkoutSelects; let index = 0;
        const tx: any = {
          select: () => queryChain(selects[index++] ?? []),
          insert: (table: unknown) => ({ values: (values: unknown) => { inserted.push({ table, values }); const result = [{ insertId: table === saleReturns ? 301 : 91 }]; return { onDuplicateKeyUpdate: async () => result, then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(result).then(resolve, reject) }; } }),
          update: (table: unknown) => { let values: unknown; const chain: any = { set: (next: unknown) => { values = next; return chain; }, where: async () => { updates.push({ table, values }); return [{ affectedRows: 1 }]; } }; return chain; },
        };
        return callback(tx);
      },
    };
    dbMocks.getDb.mockResolvedValue(rootDb);
    const returned = await processPartialReturn({ saleId: 91, cashSessionId: 8, reasonCode: "wrong_item", refundMethod: "cash", processedById: 44, approvedById: 55, items: [{ saleItemId: 22, quantity: "1" }] });
    const handoff = parseExchangeHandoff(createExchangeHandoffHref({ returnId: returned.returnId, refundAmount: Number(returned.refundAmount) }));
    const replacementQuote = await quoteCheckout({ locationId: 3, lines: [{ productId: 9, quantity: "1" }] });
    const replacement = await completeCheckout({ locationId: 3, registerId: 4, cashSessionId: 8, cashierId: 44, paymentMethod: "cash", amountTendered: "120.00", exchangeReturnId: handoff?.returnId, idempotencyKey: "integrated-exchange-workflow-0001", lines: [{ productId: 9, quantity: "1" }] });
    expect(returned).toMatchObject({ returnId: 301, refundAmount: "100.00", locationId: 3 });
    expect(handoff).toEqual({ returnId: 301, refundAmount: 100 });
    expect({ refundAmount: handoff?.refundAmount.toFixed(2), replacementTotal: replacementQuote.totalAmount, netDifference: (Number(replacementQuote.totalAmount) - Number(handoff?.refundAmount)).toFixed(2) }).toEqual({ refundAmount: "100.00", replacementTotal: "112.00", netDifference: "12.00" });
    expect(replacement.receipt).toMatchObject({ exchange: { returnId: 301 }, totalAmount: "112.00" });
    expect(updates.find(entry => entry.table === saleReturns)?.values).toEqual({ exchangeSaleId: replacement.saleId });
  });
});
