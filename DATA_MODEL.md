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
| `cashSessions` | Opening float, expected cash, counted close, variance | Belongs to a register and location; opened/closed by staff |

## Catalog and inventory

| Entity | Purpose | Audit behavior |
|---|---|---|
| `categories` | Product grouping | Archived rather than deleted |
| `products` | Global SKU, PHP price, cost price, and tax configuration | Archived rather than deleted; historical sale lines retain snapshots |
| `locationInventory` | Quantity, threshold, reorder quantity, and local price override | One row per location/product |
| `stockMovements` | Receiving, adjustment, sale, void, shipment, and receipt events | **Append-only** inventory audit ledger |
| `stockTransfers` and `stockTransferItems` | Inter-location request, shipment, receipt, and cancellation | Status transitions preserve the transfer history |

## Sales, payments, and receipts

| Entity | Purpose | Notes |
|---|---|---|
| `sales` | Checkout header with location, register, cashier, member, and PHP totals | Completed and voided states are tracked explicitly |
| `saleItems` | Product line quantities, pricing snapshots, discounts, and tax | Tied to the sale for receipt integrity |
| `payments` | Mock payment method, authorization result, PHP paid/change values | Supports Cash, GCash, Maya, QR Ph, debit, credit, and bank transfer |
| `receipts` | Digital receipt number and immutable presentation data | Retrieved with cashier, member, payment, tax, and item information |

Checkout is transactional: a successful sale writes sale, items, payment, receipt, stock reduction, stock movement, and loyalty earning together. Failed non-cash payment simulation creates none of these records. A void creates reversal-oriented records rather than altering prior sale or ledger history.

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
