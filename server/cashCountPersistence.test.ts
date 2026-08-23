import { describe, expect, it } from "vitest";

import { upsertCashCountEntries } from "./db";

describe("cash count persistence", () => {
  it("uses the duplicate-key update path so a recount replaces the existing session-denomination value", async () => {
    const rows = new Map<string, { quantity: number; countedAmount: string; countedById: number }>();
    let duplicateUpdates = 0;
    const tx = {
      insert: () => ({
        values: (values: Array<{ cashSessionId: number; denomination: string; quantity: number; countedAmount: string; countedById: number }>) => ({
          onDuplicateKeyUpdate: async () => {
            duplicateUpdates += 1;
            values.forEach(value => rows.set(`${value.cashSessionId}:${value.denomination}`, { quantity: value.quantity, countedAmount: value.countedAmount, countedById: value.countedById }));
          },
        }),
      }),
    };
    await upsertCashCountEntries(tx, { cashSessionId: 8, countedById: 44, entries: [{ denomination: "100.00", quantity: 3 }] });
    await upsertCashCountEntries(tx, { cashSessionId: 8, countedById: 55, entries: [{ denomination: "100.00", quantity: 5 }] });
    expect(duplicateUpdates).toBe(2);
    expect(rows).toEqual(new Map([["8:100.00", { quantity: 5, countedAmount: "500.00", countedById: 55 }]]));
  });
});
