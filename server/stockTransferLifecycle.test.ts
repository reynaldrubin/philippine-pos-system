import { describe, expect, it } from "vitest";
import { locationInventory, stockMovements, stockTransferItems, stockTransfers } from "../drizzle/schema";
import { applyStockTransferCancellationInTransaction, applyStockTransferReceiptInTransaction, applyStockTransferRequestInTransaction, applyStockTransferShipmentInTransaction } from "./db";

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

describe("stock transfer lifecycle writes", () => {
  const header = { sourceLocationId: 1, destinationLocationId: 2, status: "requested" };
  const items = [{ id: 9, productId: 31, quantityRequested: "4", quantityShipped: "4" }];

  it("creates a requested transfer header and all requested item records", async () => {
    const { tx, writes } = writeTrackingTransaction();
    const requestTx = { ...tx, insert: (table: unknown) => ({ values: async (values: any) => { writes.push({ kind: "insert", table, values }); return table === stockTransfers ? [{ insertId: 70 }] : undefined; } }) };
    await expect(applyStockTransferRequestInTransaction(requestTx, { transferNumber: "TRF-000070", sourceLocationId: 1, destinationLocationId: 2, requestedById: 10, note: "Replenish branch", items: [{ productId: 31, quantityRequested: "4" }] })).resolves.toBe(70);
    expect(writes).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "insert", table: stockTransfers, values: expect.objectContaining({ transferNumber: "TRF-000070", sourceLocationId: 1, destinationLocationId: 2, requestedById: 10 }) }),
      expect.objectContaining({ kind: "insert", table: stockTransferItems, values: [{ transferId: 70, productId: 31, quantityRequested: "4" }] }),
    ]));
  });

  it("ships requested inventory, records an immutable shipment movement, and advances the transfer", async () => {
    const { tx, writes } = writeTrackingTransaction();
    await applyStockTransferShipmentInTransaction(tx, header, items, 70, 11);
    expect(writes).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "update", table: locationInventory }),
      expect.objectContaining({ kind: "update", table: stockTransferItems, values: expect.objectContaining({ quantityShipped: "4" }) }),
      expect.objectContaining({ kind: "insert", table: stockMovements, values: expect.objectContaining({ locationId: 1, productId: 31, quantityDelta: "-4", movementType: "transfer_shipment", referenceId: 70 }) }),
      expect.objectContaining({ kind: "update", table: stockTransfers, values: expect.objectContaining({ status: "shipped", shippedById: 11 }) }),
    ]));
  });

  it("receives shipped inventory, records an immutable receipt movement, and advances the transfer", async () => {
    const { tx, writes } = writeTrackingTransaction();
    await applyStockTransferReceiptInTransaction(tx, { ...header, status: "shipped" }, items, 70, 12);
    expect(writes).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "insert", table: locationInventory, values: expect.objectContaining({ locationId: 2, productId: 31, quantity: "4" }) }),
      expect.objectContaining({ kind: "update", table: stockTransferItems, values: expect.objectContaining({ quantityReceived: "4" }) }),
      expect.objectContaining({ kind: "insert", table: stockMovements, values: expect.objectContaining({ locationId: 2, productId: 31, quantityDelta: "4", movementType: "transfer_receipt", referenceId: 70 }) }),
      expect.objectContaining({ kind: "update", table: stockTransfers, values: expect.objectContaining({ status: "received", receivedById: 12 }) }),
    ]));
  });

  it("rejects invalid status transitions before inventory or movement writes", async () => {
    const shipment = writeTrackingTransaction();
    await expect(applyStockTransferShipmentInTransaction(shipment.tx, { ...header, status: "cancelled" }, items, 70, 11)).rejects.toThrow("Only requested transfers can be shipped");
    expect(shipment.writes).toHaveLength(0);
    const receipt = writeTrackingTransaction();
    await expect(applyStockTransferReceiptInTransaction(receipt.tx, header, items, 70, 12)).rejects.toThrow("Only shipped transfers can be received");
    expect(receipt.writes).toHaveLength(0);
  });

  it("cancels only a requested transfer through an explicit status update", async () => {
    const cancellation = writeTrackingTransaction();
    await expect(applyStockTransferCancellationInTransaction(cancellation.tx, 70)).resolves.toBeUndefined();
    expect(cancellation.writes).toEqual([expect.objectContaining({ kind: "update", table: stockTransfers, values: { status: "cancelled" } })]);
    const refused = { tx: { update: (table: unknown) => ({ set: (values: any) => ({ where: async () => { refused.writes.push({ kind: "update", table, values }); return [{ affectedRows: 0 }]; } }) }) }, writes: [] as Array<any> };
    await expect(applyStockTransferCancellationInTransaction(refused.tx, 70)).rejects.toThrow("Only requested transfers can be cancelled");
    expect(refused.writes).toHaveLength(1);
  });
});
