export type ExchangeHandoff = { returnId: number; refundAmount: number };

export function createExchangeHandoffHref(input: ExchangeHandoff) {
  if (!Number.isInteger(input.returnId) || input.returnId <= 0) throw new Error("A valid completed return is required for an exchange handoff");
  if (!Number.isFinite(input.refundAmount) || input.refundAmount < 0) throw new Error("A valid recorded refund is required for an exchange handoff");
  const parameters = new URLSearchParams({ exchangeReturnId: String(input.returnId), exchangeRefundAmount: input.refundAmount.toFixed(2) });
  return `/register?${parameters.toString()}`;
}

export function parseExchangeHandoff(search: string): ExchangeHandoff | undefined {
  const query = search.includes("?") ? search.slice(search.indexOf("?")) : search;
  const parameters = new URLSearchParams(query);
  const returnId = Number(parameters.get("exchangeReturnId"));
  const refundAmount = Number(parameters.get("exchangeRefundAmount"));
  if (!Number.isInteger(returnId) || returnId <= 0 || !Number.isFinite(refundAmount) || refundAmount < 0) return undefined;
  return { returnId, refundAmount };
}
