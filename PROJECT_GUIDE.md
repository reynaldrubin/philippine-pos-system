# PosQ · Philippine Retail POS & Loyalty

This project uses a managed **React/Vite, Express/tRPC, Drizzle, and MySQL/TiDB** stack for Philippine retail POS, inventory, receipts, payments, and loyalty operations.

| Document | Use it for |
|---|---|
| [OPERATIONS.md](./OPERATIONS.md) | Local commands, staff and member workflows, validation status, and operating controls |
| [DATA_MODEL.md](./DATA_MODEL.md) | Business entities, relationships, immutable audit records, and location scoping |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Managed deployment configuration, runtime expectations, and release checklist |

> The application stores monetary amounts as two-decimal PHP values and uses ledger-style records for inventory and loyalty events. It does not use PostgreSQL or Prisma; those earlier options were superseded by the approved managed stack.
