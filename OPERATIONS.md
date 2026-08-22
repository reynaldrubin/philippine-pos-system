# Philippine Multi-Location POS & Loyalty — Operations Guide

## Purpose and architecture

This project is a Philippine retail Point-of-Sale and loyalty application built on **React 19, Vite, Tailwind CSS, Zustand, Express, tRPC, Drizzle ORM, and managed MySQL/TiDB**. The application uses Philippine Peso (`PHP`) values with two-decimal precision. Sales, inventory, receipts, payments, loyalty balances, and audit-oriented ledgers are stored through the managed SQL database.

For the complete entity map and deployment release checklist, see [DATA_MODEL.md](./DATA_MODEL.md) and [DEPLOYMENT.md](./DEPLOYMENT.md). The documentation index is [PROJECT_GUIDE.md](./PROJECT_GUIDE.md).

| Area | Primary implementation |
|---|---|
| Staff workspace | `/login` followed by the role-aware staff application |
| Member portal | `/portal` with separate member bearer-token sessions |
| API boundary | tRPC procedures under `/api/trpc` |
| Database schema | `drizzle/schema.ts` |
| Domain helpers | `server/db.ts` and `server/checkoutService.ts` |
| Authorization | `server/posAuth.ts` plus JWT utilities in `server/authTokens.ts` |

## Local development

The managed project injects the database, JWT, OAuth, and platform variables. Do not commit an `.env` file with credentials. Start the development service and run checks from the project root.

```bash
pnpm run dev
pnpm check
pnpm test
pnpm build
```

Database changes follow a schema-first process. Update `drizzle/schema.ts`, generate and inspect a migration, then apply the approved SQL migration through the managed database interface. Do not modify production data merely to create test accounts.

## Staff roles and retail hierarchy

The user-facing title is validated against the server-enforced authorization role. Menu assignments control **visibility only**; they never replace backend authorization.

| Philippine retail title | System role | Core scope |
|---|---|---|
| Head Office Owner, Operations Manager | Admin | All locations, staff, location configuration, and reports |
| Area Manager, Branch Manager, Store Manager, Supervisor | Manager | Assigned locations, inventory, transfers, reports, and point adjustments |
| Cashier, Sales Associate | Cashier | Assigned-location registers, checkout, member lookup, and enrollment |

An authenticated project owner may initialize the first Admin password only while no active password-based Admin exists. Once initialized, the staff login displays an explanatory message instead of repeatedly presenting the owner initialization action.

## Daily store workflow

Open the **Operations** workspace, select an assigned location, create or select a register, and open a cash session with its opening float. Cashiers process eligible sales from **Register**. Managers or Admins can close sessions with the counted cash amount and review expected cash and variance in **Reports**.

The supported mock payment methods are Cash, GCash, Maya, QR Ph, debit card, credit card, and bank transfer. Checkout validates stock, produces a digital receipt, records payment data, decrements stock, appends a stock movement, and completes loyalty earning atomically. A void restores inventory and appends the corresponding loyalty reversal; historical ledger entries are never edited or deleted.

## Inventory and transfers

The **Inventory** workspace supports category creation and archiving, product creation and catalog maintenance, location price overrides, low-stock thresholds, reorder quantities, quantity adjustments, low-stock visibility, and stock movement review. Product and category archive actions preserve historical sale data.

The **Transfers** workspace supports multi-line transfer requests between assigned locations. A transfer proceeds through `requested`, `shipped`, and `received` states. Staff at the source location ship the request; staff at the destination receive it. Requested transfers may be cancelled. All state-changing procedures enforce assigned-location access on the server.

## Loyalty operations

Staff can enroll a member, issue a QR-compatible digital card, search by member number, mobile, email, or QR token, and inspect contact data, status, joined date, current balance, lifetime totals, purchase history, and the immutable points ledger. Managers and Admins may append a documented manual adjustment; the adjustment updates the balance through the ledger rather than altering a prior entry.

The default earning rule is **1 point per complete ₱100 of qualifying net spend after discounts and before tax**, using floor rounding. Points are awarded only after successful checkout. The member portal at `/portal` presents separate member login, balance, QR e-card, recent purchase history, and immutable points activity.

## Reporting and management

Managers and Admins can use **Reports** from the staff sidebar to review active-location daily revenue, top-selling products, low-stock alerts, cash-session summaries, location comparison, loyalty enrollment, issued and reversed points, adjustment counts, and location-scoped top members. The **Overview** page also displays live authorized cash-session and loyalty figures for managers and Admins.

Admins manage locations from **Operations**, including real active/inactive state, editing location details, activation, and deactivation. Staff account hierarchy, branch assignments, activation state, and menu visibility are managed from **Staff & access**.

## Validation status

The latest automated validation run completed successfully:

| Check | Result |
|---|---|
| TypeScript check | Passing |
| Vitest suite | 62 tests across 25 test files passing |
| Production build | Passing with route and vendor code splitting; no chunk-size warning |

## Validation record and outstanding acceptance checks

| Workflow or control | Evidence completed | Current result |
|---|---|---|
| Owner bootstrap | Status, initialization, post-bootstrap staff token, visible state selection, and browser-like component transition to staff session | Passing |
| Staff checkout and receipt integrity | PHP pricing, payment failure rollback, idempotency, receipt content, stock movement, and completed-sale void reversal tests | Passing |
| Manager operations | Location authorization, catalog archive protection, stock-transfer request/shipment/receipt/cancellation, inventory movements, cash-session report authorization, and default Reports visibility tests | Passing |
| Loyalty member portal | Member-auth authorization, isolated-token routing, login, loading, dashboard, QR-card payload, logout, and token-clearing component tests | Passing |
| Public routes | Staff login and member portal rendered after route/vendor code splitting | Passing |

The following acceptance checks intentionally remain **deferred at the user's request** because they require temporary, valid staff and member credentials in the live browser: Admin staff profile mutation feedback; cashier checkout through a live session; manager inventory, transfer, cash-session, and report interactions; and member portal login with a live account. Before publication, run these checks with non-production test credentials, confirm the expected records in the managed database, and retain the results with the release record.
| Restarted development service | Started without current browser or module errors |

Authenticated browser workflows remain intentionally deferred at the user’s request because no temporary staff or member test credentials were supplied. The deferred checks are: owner-bootstrap UI in an uninitialized state; Admin staff profile editing; staff checkout and receipt flow; manager inventory, transfer, and report flow; and member portal login, dashboard loading, logout, and token clearing.

## Operational controls

Staff and member JWTs are distinct and kept in separate browser-session keys. The API client selects the member token only under `/portal`; staff pages use the staff token. Expired or invalid staff tokens clear the staff session and return to `/login`. Invalid member portal tokens clear the member session and return to `/portal`.

When authenticated testing resumes, use temporary accounts only. Sign out after testing, do not create database fixtures solely for browser tests, and record any observed defect before modifying the workflow.
