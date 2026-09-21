# PosQ End-to-End Reporting Audit and Enhancement Plan

## Audit findings

The reporting foundation is manager/admin protected and location-scoped, but the current dashboard contract is intentionally **today-only**. `getLocationDashboardReport` hard-codes the local day and returns a point-in-time total plus top products; it does not expose a reusable date-range or time-series contract. The current Insights page therefore presents live KPIs and AI signals without historical context, making trend direction and period comparison impossible. The Report Builder has metric, grouping, and presentation controls in local React state only; configurations disappear on refresh and cannot be shared or reused.

The existing sales schema already provides the necessary indexed dimensions: `locationId`, `status`, `totalAmount`, `createdAt`, and sale-item snapshots. The current authorization boundary uses `managerProcedure` plus `requireLocationAccess`, which should be retained for both historical reports and template operations. The additive schema pattern is established through the existing Drizzle migration journal, so saved templates can be introduced without disturbing sales or fiscal records.

## Implementation plan

1. Add a reusable date-range report service with validated inclusive start/end dates, daily buckets, totals, and top-product aggregation. Keep the existing today-only procedure backward-compatible while adding a historical procedure.
2. Add a manager-owned `reportTemplates` table containing name, metric, grouping, presentation, date-range defaults, location scope, and timestamps. Store only validated configuration metadata; no sale data is copied into the template.
3. Add protected list/create/update/delete procedures. Managers may manage their own templates; admins may manage templates for their own account as well. Enforce location scope at save time and audit template mutations.
4. Add date-range controls and a historical daily trend chart to Insights, with preset ranges and custom start/end dates. Keep current operational cards and AI indicators, but label the selected period clearly.
5. Add save/load/delete controls to Report Builder. Loading a template restores the complete configuration, while the report remains live and is recalculated from the selected date range.
6. Add regression coverage for date validation, historical aggregation authorization, template ownership, UI save/load behavior, migration generation/application, TypeScript, tests, and production build.

## Acceptance criteria

- Managers can select a preset or custom date range and see daily revenue/transaction trends.
- Historical queries cannot cross unauthorized locations.
- Managers can save, load, and delete named report configurations without duplicating transactional data.
- Existing today-only reports and current dashboard workflows remain compatible.
- All automated tests, type checks, and production build pass before checkpointing.
