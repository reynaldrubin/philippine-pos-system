import { describe, expect, it } from "vitest";
import { applyLoyaltyAdjustmentInTransaction } from "./db";

describe("manual loyalty adjustment ledger", () => {
  it("updates the account balance and appends one immutable adjustment entry without changing prior entries", async () => {
    const account = { id: 3, memberId: 8, currentPoints: 12 };
    const priorEntries = [{ id: 1, type: "earn", points: 12, balanceAfter: 12 }];
    const entries = [...priorEntries];
    const tx = {
      select: () => ({ from: () => ({ where: () => ({ limit: async () => [account] }) }) }),
      update: () => ({ set: (values: { currentPoints: number }) => ({ where: async () => { account.currentPoints = values.currentPoints; } }) }),
      insert: () => ({ values: async (entry: Record<string, unknown>) => { entries.push({ id: entries.length + 1, ...entry } as typeof entries[number]); } }),
    };
    await expect(applyLoyaltyAdjustmentInTransaction(tx, { memberId: 8, points: 5, note: "Service recovery", createdById: 91 })).resolves.toBe(17);
    expect(account.currentPoints).toBe(17);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toEqual(priorEntries[0]);
    expect(entries[1]).toMatchObject({ type: "adjustment", memberId: 8, accountId: 3, points: 5, balanceAfter: 17, note: "Service recovery", createdById: 91 });
  });

  it("rejects a manual adjustment that would make the balance negative before it writes a ledger entry", async () => {
    const account = { id: 3, memberId: 8, currentPoints: 2 };
    const entries: unknown[] = [];
    const tx = {
      select: () => ({ from: () => ({ where: () => ({ limit: async () => [account] }) }) }),
      update: () => ({ set: () => ({ where: async () => { throw new Error("must not update"); } }) }),
      insert: () => ({ values: async (entry: unknown) => { entries.push(entry); } }),
    };
    await expect(applyLoyaltyAdjustmentInTransaction(tx, { memberId: 8, points: -3, note: "Invalid deduction", createdById: 91 })).rejects.toThrow("Point adjustment cannot create a negative balance");
    expect(account.currentPoints).toBe(2);
    expect(entries).toHaveLength(0);
  });
});
