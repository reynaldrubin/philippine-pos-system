export function formatFiscalDocumentNumber(prefix: string, sequenceNumber: number, numberPadding: number) {
  if (!Number.isInteger(sequenceNumber) || sequenceNumber <= 0) throw new Error("Fiscal document sequence must be a positive integer");
  if (!Number.isInteger(numberPadding) || numberPadding < 3 || numberPadding > 12) throw new Error("Fiscal document padding must be between 3 and 12 digits");
  const normalizedPrefix = prefix.trim();
  if (!normalizedPrefix) throw new Error("Fiscal document prefix is required");
  return `${normalizedPrefix}${String(sequenceNumber).padStart(numberPadding, "0")}`;
}
