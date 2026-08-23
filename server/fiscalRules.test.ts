import { describe, expect, it } from "vitest";
import { formatFiscalDocumentNumber } from "./fiscalRules";

describe("fiscal document numbering", () => {
  it("formats padded sequential invoice numbers with the configured prefix", () => {
    expect(formatFiscalDocumentNumber("MNL-INV-", 42, 8)).toBe("MNL-INV-00000042");
  });

  it("rejects unusable sequence, padding, and prefix values before allocation", () => {
    expect(() => formatFiscalDocumentNumber("INV-", 0, 8)).toThrow("positive integer");
    expect(() => formatFiscalDocumentNumber("INV-", 1, 2)).toThrow("between 3 and 12");
    expect(() => formatFiscalDocumentNumber("   ", 1, 8)).toThrow("prefix is required");
  });
});
