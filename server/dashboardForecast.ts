import { invokeLLM } from "./_core/llm";

export type DashboardForecastInput = {
  locationCode: string;
  locationName: string;
  revenue: string | number;
  transactionCount: number;
  topProducts: Array<{ name: string; sku: string; revenue: string | number }>;
  openCashSessions: number;
  totalVariance: string | number;
  lowStockCount: number;
  activeMembers: number;
  parkedOrders: number;
};

export type DashboardForecast = {
  headline: string;
  confidence: number;
  forecast: string;
  indicators: Array<{
    label: string;
    value: string;
    status: "positive" | "watch" | "risk";
    detail: string;
    action: string;
  }>;
};

const fallbackForecast = (input: DashboardForecastInput): DashboardForecast => ({
  headline: input.lowStockCount > 0 ? "Replenishment should be your next priority" : "Operations are tracking steadily",
  confidence: 72,
  forecast: input.transactionCount > 0
    ? `Based on ${input.transactionCount} completed transaction${input.transactionCount === 1 ? "" : "s"}, current demand is active. Keep the top-selling lines available and monitor the next cash close.`
    : "There is not enough completed-sale history for a reliable demand forecast yet. Start the register to build a stronger signal.",
  indicators: [
    { label: "Demand signal", value: input.transactionCount > 0 ? "Active" : "Building", status: input.transactionCount > 0 ? "positive" : "watch", detail: `${input.transactionCount} completed transaction${input.transactionCount === 1 ? "" : "s"} recorded today.`, action: "Review top products" },
    { label: "Stock pressure", value: `${input.lowStockCount} alert${input.lowStockCount === 1 ? "" : "s"}`, status: input.lowStockCount > 0 ? "risk" : "positive", detail: input.lowStockCount > 0 ? "Items are at or below their reorder threshold." : "No products are currently below threshold.", action: "Open inventory" },
    { label: "Cash readiness", value: `${input.openCashSessions} open`, status: input.totalVariance === 0 || input.totalVariance === "0.00" ? "positive" : "watch", detail: `Recent cash variance is ₱${Number(input.totalVariance || 0).toFixed(2)}.`, action: "Review cash controls" },
  ],
});

export async function generateDashboardForecast(input: DashboardForecastInput): Promise<DashboardForecast> {
  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: "You are PosQ AI Operations Analyst for a Philippine retail store. Analyze only the supplied POS metrics. Never invent transactions, financial facts, or certainty. Return concise, actionable PHP-aware operational guidance for a manager." },
        { role: "user", content: JSON.stringify({ location: `${input.locationCode} · ${input.locationName}`, metrics: input }) },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "posq_dashboard_forecast",
          strict: true,
          schema: {
            type: "object",
            properties: {
              headline: { type: "string" },
              confidence: { type: "number", minimum: 0, maximum: 100 },
              forecast: { type: "string" },
              indicators: {
                type: "array",
                minItems: 3,
                maxItems: 5,
                items: {
                  type: "object",
                  properties: {
                    label: { type: "string" },
                    value: { type: "string" },
                    status: { type: "string", enum: ["positive", "watch", "risk"] },
                    detail: { type: "string" },
                    action: { type: "string" },
                  },
                  required: ["label", "value", "status", "detail", "action"],
                  additionalProperties: false,
                },
              },
            },
            required: ["headline", "confidence", "forecast", "indicators"],
            additionalProperties: false,
          },
        },
      },
    });
    const content = response.choices[0]?.message.content;
    const parsed = typeof content === "string" ? JSON.parse(content) as DashboardForecast : null;
    if (parsed?.headline && Array.isArray(parsed.indicators)) return parsed;
  } catch (error) {
    console.warn("AI dashboard forecast unavailable; using deterministic indicators", error);
  }
  return fallbackForecast(input);
}

export { fallbackForecast };
