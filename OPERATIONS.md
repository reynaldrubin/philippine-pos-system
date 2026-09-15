# PosQ · Philippine Retail POS & Loyalty — Operations Guide

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

Open the **Operations** workspace, select an assigned location, create or select a register, and open a cash session with its opening float. Cashiers process eligible sales from **Register**. Managers and Admins use **Cash controls** to save a PHP denomination count, submit or review safe drops, and review pending material variances. Use **Close cash session** to enter the final cash total; a difference of at least ₱100 requires a written explanation and remains pending approval by a different Manager or Admin. Approved safe drops reduce expected cash only after the separate review is recorded.

The supported mock payment methods are Cash, GCash, Maya, QR Ph, debit card, credit card, and bank transfer. Checkout validates stock, produces a digital receipt, records payment data, decrements stock, appends a stock movement, and completes loyalty earning atomically. A void restores inventory and appends the corresponding loyalty reversal; historical ledger entries are never edited or deleted.

## Inventory and transfers

The **Inventory** workspace supports category creation and archiving, product creation and catalog maintenance, location price overrides, low-stock thresholds, reorder quantities, quantity adjustments, low-stock visibility, and stock movement review. Product and category archive actions preserve historical sale data. Overview and Inventory present low-stock alerts as operational notifications; no background notification delivery is claimed until scheduled infrastructure is configured.

The **Transfers** workspace supports multi-line transfer requests between assigned locations. A transfer proceeds through `requested`, `shipped`, and `received` states. Staff at the source location ship the request; staff at the destination receive it. Requested transfers may be cancelled. All state-changing procedures enforce assigned-location access on the server.

## Loyalty operations

Staff can enroll a member, issue a QR-compatible digital card, search by member number, mobile, email, or QR token, and inspect contact data, status, joined date, current balance, lifetime totals, purchase history, and the immutable points ledger. Managers and Admins may append a documented manual adjustment; the adjustment updates the balance through the ledger rather than altering a prior entry.

The default earning rule is **1 point per complete ₱100 of qualifying net spend after discounts and before tax**, using floor rounding. Points are awarded only after successful checkout. The member portal at `/portal` presents separate member login, balance, QR e-card, recent purchase history, and immutable points activity.

## Reporting and management

Managers and Admins can use **Reports** from the staff sidebar to review active-location daily revenue, top-selling products, low-stock alerts, cash-session summaries, location comparison, loyalty enrollment, issued and reversed points, adjustment counts, and location-scoped top members. The **Overview** page also displays live authorized cash-session and loyalty figures for managers and Admins.

Admins manage locations from **Operations**, including real active/inactive state, editing location details, activation, and deactivation. Staff account hierarchy, branch assignments, activation state, and menu visibility are managed from **Staff & access**.

Admins can open **Fiscal & audit** to manage business profiles, tax-registration references, location invoice series, receipt-device records, issued fiscal document history, and privacy-aware audit events. An active invoice series is optionally issued inside a completed checkout transaction. This is readiness data and controlled sequencing only: it is **not** a representation of BIR certification, EIS submission, or compliance approval.

Admins can open **Store Settings · POS Register Display** from Operations and choose **Cafe/F&B, Hardware, Grocery/Supermarket, or Standard Retail**. The choice is persisted in `systemSettings` and read by Register for category tabs, dense SKU rows, scanner-first prompts, or balanced product cards. Register also supports Philippine Senior Citizen/PWD 20% discount selection with VAT exemption, and the server requires a transaction/reference number for non-cash digital payments.

Managers and Admins can use the **Cash drawer movements** panel in Operations to append a PHP cash-in or cash-out record with a category, note, and optional open-session link. These entries do not rewrite sales or cash-session totals; they provide an auditable operational trail alongside the existing safe-drop and close controls. The **Staff attendance** panel records append-only time-in and time-out events for the selected branch. Cashiers may record only their own events; Managers and Admins can review the location history, while Admins can record an event for a selected staff account.

Managers and Admins use **Partial returns** to retrieve an original completed sale, choose remaining eligible quantities, document a reason, select a mock refund method, and complete an immutable return. The transaction creates a distinct return header, return items, refund-payment record, and inventory-restoration movement without editing the original completed sale or payment. After completion, the workspace can hand off to a **linked replacement sale** in Register. That checkout is limited to the same location and one replacement sale per return. Register displays the already-recorded refund, replacement total, and resulting net difference; the refund and replacement payment remain separate immutable financial records.

## Validation status

The latest automated validation run completed successfully:

| Check | Result |
|---|---|
| TypeScript check | Passing |
| Vitest suite | 106 tests across 46 test files passing |
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

Authenticated browser workflows remain intentionally deferred at the user’s request because no temporary staff or member test credentials were supplied. The deferred checks are: owner-bootstrap UI in an uninitialized state; Admin staff profile editing; staff checkout and receipt flow; manager inventory, transfer, cash movement, attendance, and report flow; and member portal login, dashboard loading, logout, and token clearing. Unauthenticated PosQ login rendering, responsive visual review, TypeScript, the full Vitest suite, production build, and additive migration application are complete.

## Operational controls

Staff and member JWTs are distinct and kept in separate browser-session keys. The API client selects the member token only under `/portal`; staff pages use the staff token. Expired or invalid staff tokens clear the staff session and return to `/login`. Invalid member portal tokens clear the member session and return to `/portal`.

When authenticated testing resumes, use temporary accounts only. Sign out after testing, do not create database fixtures solely for browser tests, and record any observed defect before modifying the workflow.
