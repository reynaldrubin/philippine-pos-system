# Data Model Reference

The Drizzle definitions in `drizzle/schema.ts` are the authoritative schema source. Migrations must be generated from that file and applied through the managed SQL migration workflow.

## Identity, roles, and locations

| Entity | Purpose | Important relationships |
|---|---|---|
| `users` | Staff credentials and role (`cashier`, `manager`, `admin`) | Assigned to locations through `userLocations`; optional job title and active status |
| `staffMenuAssignments` | Staff navigation visibility | References a staff user; does not replace server permissions |
| `locations` | Branch, store, warehouse, or kiosk | Owns registers, stock, sales, cash sessions, and location reports |
| `userLocations` | Branch assignment and primary location | Links `users` to `locations` |
| `registers` | POS till/register endpoint | Belongs to one location and owns cash sessions |
| `cashSessions` | Opening float, expected cash, counted close, variance, explanation, and approval state | Belongs to a register and location; material variances require a reason and manager/Admin approval |
| `cashCountEntries` | Cash count by PHP denomination | One entry per denomination and cash session; supports reproducible counted totals |
| `cashSafeDrops` | Controlled mid-session removal of cash | Pending/approved/rejected state, distinct reviewer, and location/session links preserve accountability |

## Catalog and inventory

| Entity | Purpose | Audit behavior |
|---|---|---|
| `categories` | Product grouping | Archived rather than deleted |
| `products` | Global SKU, PHP price, cost price, and tax configuration | Archived rather than deleted; historical sale lines retain snapshots |
| `locationInventory` | Quantity, threshold, reorder quantity, and local price override | One row per location/product |
| `stockMovements` | Receiving, adjustment, sale, void, return, shipment, and receipt events | **Append-only** inventory audit ledger |
| `stockTransfers` and `stockTransferItems` | Inter-location request, shipment, receipt, and cancellation | Status transitions preserve the transfer history |

## Sales, payments, and receipts

| Entity | Purpose | Notes |
|---|---|---|
| `sales` | Checkout header with location, register, cashier, member, and PHP totals | Completed and voided states are tracked explicitly |
| `saleItems` | Product line quantities, pricing snapshots, discounts, and tax | Tied to the sale for receipt integrity |
| `payments` | Mock payment method, authorization result, PHP paid/change values | Supports Cash, GCash, Maya, QR Ph, debit, credit, and bank transfer |
| `receipts` | Digital receipt number and immutable presentation data | Retrieved with cashier, member, payment, tax, and item information |
| `saleReturns` | Immutable partial-return header linked to its original completed sale | Stores manager authorization, reason, refund method, total refund amount, and optional one-to-one replacement sale for exchanges |
| `saleReturnItems` | Returned original sale lines and quantities | Caps cumulative returned quantity through service validation; restores inventory via a new movement |
| `returnPayments` | Refund payment ledger | Keeps a separate refund reference rather than overwriting an original payment |

Checkout is transactional: a successful sale writes sale, items, payment, receipt, stock reduction, stock movement, and loyalty earning together. Failed non-cash payment simulation creates none of these records. A void creates reversal-oriented records rather than altering prior sale or ledger history.

## Security, audit, and fiscal readiness

| Entity | Purpose | Control boundary |
|---|---|---|
| `authRateLimits` | Persistent staff/member login failure counters keyed by a hashed identifier and request source | Enforces expiring throttles across instances without storing the raw identifier or source value |
| `auditLogs` | Best-effort, privacy-aware operational event trail | Stores action, entity, actor, location, and sanitized metadata; audit unavailability does not block the operational transaction |
| `businessProfiles` and `taxRegistrations` | Legal-entity and registration-reference configuration | Admin-only fiscal readiness configuration |
| `invoiceSeries`, `receiptDevices`, and `fiscalDocuments` | Per-location sequential invoice numbering and device records | An active series is optionally allocated within completed checkout; document allocation is transactionally locked |

> Fiscal tables and sequential numbering are configurable groundwork only. They do **not** establish BIR certification, EIS integration, tax compliance, or payment-provider certification.

## Loyalty and member portal

| Entity | Purpose | Audit behavior |
|---|---|---|
| `loyaltyMembers` | Member identity, contact information, status, portal password, and joined location | Has a unique member number |
| `loyaltyCards` | E-card number, display token, and card status | QR-compatible token is safe for checkout lookup |
| `loyaltyAccounts` | Current balance and lifetime earned/redeemed counters | Updated only alongside a corresponding ledger event |
| `loyaltyTransactions` | Earn, reversal, or manager adjustment event | **Append-only** points ledger with balance-after value |

The standard rule awards one point for each full PHP 100 of qualifying net spend after discount and before tax. Earnings occur only after successful checkout. Sale voids append a reversal. Manual adjustments reject any operation that would produce a negative balance, update the account, and append a new `adjustment` row without changing prior entries.

## Configuration and integrity

`systemSettings` holds application-level configuration. SQL constraints, server-side authorization procedures, transaction boundaries, idempotency keys, and immutable movement/ledger rows provide the principal integrity controls. Client-side navigation and menu visibility are convenience controls; all privileged actions are authorized again on the server.
