import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const dbMocks = vi.hoisted(() => ({ hasInitializedAdmin: vi.fn() }));
vi.mock("./db", async importOriginal => ({ ...(await importOriginal<typeof import("./db")>()), ...dbMocks }));

import { appRouter } from "./routers";

const ctx: TrpcContext = { user: null, req: { headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] };

describe("owner bootstrap status", () => {
  it("reports when the first Admin account has already been initialized", async () => {
    dbMocks.hasInitializedAdmin.mockResolvedValue(true);
    await expect(appRouter.createCaller(ctx).bootstrap.status()).resolves.toEqual({ initialized: true });
  });
  it("reports setup as pending only when no initialized Admin exists", async () => {
    dbMocks.hasInitializedAdmin.mockResolvedValue(false);
    await expect(appRouter.createCaller(ctx).bootstrap.status()).resolves.toEqual({ initialized: false });
  });
});
