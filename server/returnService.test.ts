import { returnPayments, saleReturnItems, saleReturns, stockMovements } from "../drizzle/schema";
import { describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("./db", () => dbMocks);

import { processPartialReturn } from "./returnService";

type Inserted = { table: unknown; values: unknown };
function createReturnDb(selectResults: unknown[][]) {
  const inserted: Inserted[] = [];
  let selectIndex = 0;
  const tx: any = {
    select: () => {
      const result = selectResults[selectIndex++] ?? [];
      const chain: any = { from: () => chain, innerJoin: () => chain, where: () => chain, limit: () => chain, for: () => chain, then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(result).then(resolve, reject) };
      return chain;
    },
    insert: (table: unknown) => ({ values: (values: unknown) => { inserted.push({ table, values }); const result = [{ insertId: table === saleReturns ? 301 : inserted.length + 400 }]; return { then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(result).then(resolve, reject) }; } }),
    update: () => { const chain: any = { set: () => chain, where: async () => [{ affectedRows: 1 }] }; return chain; },
  };
  return { rootDb: { transaction: async (callback: (transaction: unknown) => Promise<unknown>) => callback(tx) }, inserted };
}

describe("partial return transaction", () => {
  it("writes immutable return, refund, and positive stock-restoration records without modifying the original sale", async () => {
    const { rootDb, inserted } = createReturnDb([
      [{ id: 91, locationId: 3, status: "completed" }],
      [{ id: 22, productId: 9, quantity: "2", lineTotal: "200.00" }],
      [],
      [{ id: 8, status: "open", locationId: 3, expectedCash: "500.00" }],
      [{ id: 66, provider: "mock", reference: "PAY-66" }],
    ]);
    dbMocks.getDb.mockResolvedValue(rootDb);
    await expect(processPartialReturn({ saleId: 91, cashSessionId: 8, reasonCode: "damaged", refundMethod: "cash", processedById: 44, approvedById: 55, items: [{ saleItemId: 22, quantity: "1" }] })).resolves.toMatchObject({ returnId: 301, locationId: 3, refundAmount: "100.00" });
    expect(inserted.find(entry => entry.table === saleReturns)?.values).toMatchObject({ saleId: 91, locationId: 3, cashSessionId: 8, reasonCode: "damaged", refundAmount: "100.00", processedById: 44, approvedById: 55 });
    expect(inserted.find(entry => entry.table === saleReturnItems)?.values).toEqual([{ returnId: 301, saleItemId: 22, productId: 9, quantity: "1", refundAmount: "100.00" }]);
    expect(inserted.find(entry => entry.table === returnPayments)?.values).toMatchObject({ returnId: 301, originalPaymentId: 66, method: "cash", amount: "100.00" });
    expect(inserted.find(entry => entry.table === stockMovements)?.values).toMatchObject({ locationId: 3, productId: 9, quantityDelta: "1", movementType: "return", referenceType: "sale_return", referenceId: 301 });
  });
});
