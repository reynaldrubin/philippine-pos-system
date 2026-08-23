import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { issueStaffAccessToken } from "./authTokens";

const dbMocks = vi.hoisted(() => ({
  allocateFiscalDocument: vi.fn(),
  appendAuditLog: vi.fn(),
  createBusinessProfile: vi.fn(),
  getStaffById: vi.fn(),
}));

vi.mock("./db", async importOriginal => ({ ...(await importOriginal<typeof import("./db")>()), ...dbMocks }));

import { appRouter } from "./routers";

function caller(role: "cashier" | "manager" | "admin") {
  const ctx: TrpcContext = { user: null, req: { headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] };
  return issueStaffAccessToken(71, role).then(token => appRouter.createCaller({ ...ctx, req: { headers: { authorization: `Bearer ${token}` } } as TrpcContext["req"] }));
}

describe("fiscal administration authorization", () => {
  it("rejects non-Admin fiscal configuration and allocation", async () => {
    dbMocks.getStaffById.mockResolvedValue({ id: 71, role: "manager", isActive: true });
    const manager = await caller("manager");
    await expect(manager.fiscal.createBusinessProfile({ legalName: "Tindahan Retail Inc.", tin: "123-456-789-000", vatStatus: "vat", registeredAddress: "Manila" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(manager.fiscal.allocateDocument({ invoiceSeriesId: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(dbMocks.appendAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "authorization.denied", userId: 71, metadata: expect.objectContaining({ policy: "staff_role", actualRole: "manager" }) }));
  });

  it("allows an Admin to create configuration and allocate a documented fiscal number", async () => {
    dbMocks.getStaffById.mockResolvedValue({ id: 71, role: "admin", isActive: true });
    dbMocks.createBusinessProfile.mockResolvedValue(8);
    dbMocks.allocateFiscalDocument.mockResolvedValue({ fiscalDocumentId: 12, locationId: 3, documentNumber: "MNL-00000001", sequenceNumber: 1 });
    const admin = await caller("admin");
    await expect(admin.fiscal.createBusinessProfile({ legalName: "Tindahan Retail Inc.", tin: "123-456-789-000", vatStatus: "vat", registeredAddress: "Manila" })).resolves.toEqual({ businessProfileId: 8 });
    await expect(admin.fiscal.allocateDocument({ invoiceSeriesId: 4 })).resolves.toMatchObject({ documentNumber: "MNL-00000001", sequenceNumber: 1 });
    expect(dbMocks.appendAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "fiscal.business_profile.created", entityId: 8 }));
    expect(dbMocks.appendAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "fiscal.document.allocated", entityId: 12 }));
  });
});
