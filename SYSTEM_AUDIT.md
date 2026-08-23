# Philippine POS & Loyalty System Audit

**Prepared by:** Manus AI  
**Audit date:** 23 August 2026 (GMT+8)  
**Scope:** Application workflows, architecture, authorization, operational controls, test evidence, public interface design, and enhancement opportunities.

## Executive assessment

The application is a **strong operational prototype and a credible foundation for a multi-location Philippine retailer**. Its core domain design is materially better than a typical point-of-sale prototype: PHP monetary values are represented as decimal strings, checkout is transactional and idempotent, stock and points are modeled as append-only ledgers, and role/location enforcement is performed in server procedures rather than relying on navigation visibility alone. The system also has a separate member portal, a clear Philippine staff hierarchy, and a sound multi-location inventory model.

The principal transition still required is from a **validated product foundation** to a **production retail platform**. The immediate priorities are live acceptance testing with temporary credentials; tax/invoice configuration; security controls around browser-held bearer tokens, rate limiting, and audit events; and replacing mock payment outcomes with provider adapters and reconciliation. These are normal next-stage investments rather than failures of the current implementation.

| Dimension | Assessment | Basis |
|---|---|---|
| Core POS and loyalty domain | **Strong foundation** | Atomic checkout, void reversal, ledger design, multi-location data model, and focused regressions are present. |
| Authorization model | **Good, with hardening needed** | Role and location checks are server-side; member status and staff-to-member access deserve further review. |
| Test evidence | **Strong automated baseline** | Type check, production build, and 69 Vitest tests across 29 files had passed at the audit baseline. |
| Live operational acceptance | **Pending** | No temporary staff/member credentials were available for live browser workflow execution. |
| Compliance readiness | **Foundation only** | Receipts are detailed, but BIR configuration, invoice controls, and EIS integration are not yet a compliance product. |
| Design and usability | **Professional and coherent** | The public entry screens are polished and legible; the visual system needs a more ownable Philippine-retail identity. |

> This is a technical and product audit, not legal, tax, payment-network, or certification advice. BIR registration, invoicing, EIS scope, and payment-provider requirements should be confirmed with qualified Philippine tax, legal, and provider contacts before launch.

## Audit boundary and evidence standard

This review distinguishes **verified automated/component evidence** from **live credentialed browser acceptance**. The latter remains pending; its absence is recorded as a release prerequisite rather than interpreted as a defect.

| Area | Evidence reviewed | Result |
|---|---|---|
| Owner bootstrap and staff access | Router contracts, JWT logic, and browser-like component tests | Verified automated/component behavior |
| Checkout, receipt, void, and payments | Checkout rules, transaction service, receipt and void lifecycle tests | Verified automated behavior |
| Multi-location inventory and transfers | Domain model, location authorization, lifecycle tests, and workspace tests | Verified automated/component behavior |
| Loyalty and member portal | Ledger model, member authorization, isolated session routing, and portal component tests | Verified automated/component behavior |
| Reporting and administration | Report authorization plus protected workspace and staff-management component tests | Verified automated/component behavior |
| Architecture, security, and operations | Dependencies, JWT middleware, route model, data model, and deployment documentation | Reviewed statically |
| UI and visual design | Staff login and member portal rendered in the live preview | Verified public-route rendering |

## What is working well

### Transaction and ledger integrity

The architecture protects the retail events that matter most. A completed checkout persists the sale, lines, payment, receipt, inventory reduction, stock movement, and loyalty earning as one transaction. A void restores inventory and appends reversal-oriented records rather than changing history. The product, category, stock, transfer, and loyalty design correctly prefers archival/status transitions and append-only movements to destructive edits.

This is a strong basis for dispute handling, cash reconciliation, loyalty support, and future financial integrations. It also aligns well with the need for consecutively trackable POS documentation and audit records in Philippine retail operations.[3]

### Server-side access enforcement

The current model correctly treats the front-end menu as a convenience layer. Staff roles, active state, and location assignments are rechecked on the server. Manager-level inventory, reporting, transfer, and cash-session workflows are location-scoped. This avoids the common error of assuming a hidden link or disabled button is an authorization control.

The staff hierarchy is clear and business-appropriate: Head Office/Operations roles map to Admin, branch/supervisory roles to Manager, and cashier/sales roles to Cashier. This enables an intuitive future permissions model based on job function rather than a generic technical role list.

### Product structure and performance baseline

The project uses a coherent React/Vite, Express/tRPC, Drizzle, and managed MySQL/TiDB stack. Protected workspaces and the member portal are route-lazy-loaded, and explicit vendor chunks keep the production build below the bundle-size warning threshold. The shared route model, data types, and tRPC contracts are a practical fit for a transaction-heavy internal web application.

### Public entry experience

The public staff login and member portal are visually coherent. Both have legible high-contrast forms, clear value propositions, adequate primary action targets, and consistent dark-green/lime visual language. The staff screen now shows an explicit initialized-Admin explanation rather than repeating the owner-bootstrap prompt.

## Findings and prioritized recommendations

### Priority 0 — required before a live retail rollout

| Recommendation | Why it matters | Suggested implementation |
|---|---|---|
| Run live role-based acceptance workflows | Automated coverage cannot validate an actual account, route data, payment interaction, or perceived workflow speed. | Use temporary Admin/Manager/Cashier/member accounts. Test bootstrap, login, location selection, register checkout/void/receipt, inventory/transfer/report actions, profile changes, and portal login/logout. Record results and database evidence. |
| Build a BIR invoice/compliance configuration domain | A digital receipt alone is not a complete compliance capability. POS receipts need merchant, branch, tax, series, and approval-oriented configuration. | Add `businessProfiles`, `taxRegistrations`, `invoiceSeries`, `receiptDevices`, and immutable fiscal-document snapshots. Add sequential, per-series invoice numbering and a compliance readiness checklist. |
| Design an Electronic Invoicing/Receipting System adapter | The BIR EIS operates as an electronic invoicing/receipting and sales-reporting environment, with API/sales transmission capability for relevant users.[1] | Introduce an `eisSubmission` outbox table, signed payload renderer, retry queue, status polling/reconciliation, and a visibly separate “tax submission” status from the payment or sale status. Do **not** couple checkout completion to a synchronous external call. |
| Replace mock payments with a payment adapter boundary | Current local methods are intentionally mock-only. A production payment result must be provider-verified and reconcilable. | Define a `PaymentProvider` interface, provider-specific transaction table, webhook verification, idempotent provider-event processing, settlement/reconciliation screen, and manual exception queue. Start with Cash plus one regulated/acquired digital rail. |
| Establish security release controls | Authentication and permission code are well structured, but production needs operational defenses beyond valid JWT verification. | Add login throttling, rate limits, authentication/authorization event logging, CSP/HSTS/header policy, secret rotation procedure, dependency scanning, and an OWASP ASVS-based release checklist.[4] [5] [6] |

### Priority 1 — high-value product and operations enhancements

| Product area | Enhancement | Operational value |
|---|---|---|
| POS | Barcode-first search, keyboard shortcuts, suspended/parked carts, cashier price-override approval, customer display mode, and receipt reprint policy | Faster counters, fewer keying errors, clearer accountability |
| Returns | Partial returns, exchanges, reason codes, original-payment constraints, manager approval, and refund settlement tracking | Avoids using a full void to handle normal post-sale service |
| Inventory | Suppliers, purchase orders, goods receiving, transfer-in-transit aging, stock counts/cycle counts, damaged/expired stock, and variance approval | Turns stock control into a replenishment and shrinkage-management system |
| Cash control | Shift close checklist, counted denomination breakdown, safe drops, over/short explanation, and approval thresholds | Improves cash accountability and manager review |
| Loyalty | Point redemption rules, tiers, expiry policy, campaign multipliers, consent preferences, member merges, and fraud/velocity checks | Evolves the portal from balance visibility to a retail retention tool |
| Reporting | Date ranges, branch comparisons, margin and tax views, exportable CSV/XLSX, scheduled manager digest, and exception reports | Makes information useful for daily retail decisions rather than only same-day monitoring |
| Customer service | Member lookup privacy masking, receipt resend, consent capture, contact preference management, and issue/adjustment case notes | Reduces operational risk around personal data and manual point corrections |

### Priority 2 — platform maturity and scale

| Theme | Recommendation | Target outcome |
|---|---|---|
| Modularity | Split the monolithic router and database helper surface by domain: `auth`, `catalog`, `inventory`, `sales`, `loyalty`, `reporting`, and `administration`. | Clearer ownership, smaller changes, safer review and testing. |
| Integration reliability | Adopt an **outbox pattern** for EIS, payment webhooks, notifications, analytics, and exports. | A committed sale is never lost because a downstream service is unavailable. |
| Reporting scale | Add daily/periodic aggregate tables or an analytics pipeline rather than calculating every dashboard view from transactional rows. | Predictable report performance as stores, products, and sales volume grow. |
| Observability | Use structured, privacy-aware application events with a correlation ID, operation result, actor, location, and object reference. | Faster incident response and a defensible operational audit trail. |
| Delivery | Add CI gates for type check, test, build, migration review, dependency audit, and a security baseline. | Repeatable release quality. |
| Resilience | Design offline-aware checkout with a local encrypted outbox, stable device IDs, conflict rules, and later reconciliation. | Better continuity for branch connectivity disruption; this should be a deliberate later phase, not an ad hoc cache. |

## Security and privacy assessment

The current system has several favorable controls: passwords use scrypt with a per-password random salt; staff tokens are revalidated against the current staff record and active state; separation exists between staff and member tokens; and key mutations use server-side authorization. The system correctly invalidates an inactive/deactivated staff account even if the token is still within its eight-hour lifetime.

The following hardening is recommended before handling meaningful payment, customer, or merchant data at scale.

| Finding | Risk level | Recommended response |
|---|---|---|
| Staff and member JWTs are held in browser session storage | High | Session storage limits persistence but remains readable by scripts executing in the origin. Evaluate an HTTP-only, Secure, SameSite cookie/BFF approach or tightly constrained short-lived access tokens with refresh rotation, CSP, and XSS defenses. OWASP notes that a session token is effectively equivalent to the authentication method while valid.[5] |
| No visible login rate limit, lockout/step-up policy, or MFA | High | Apply per-account and IP/device throttles, alert on password spraying, add administrator MFA, and require reauthentication for high-risk actions such as role changes, payment configuration, or large manual adjustments. |
| Member middleware verifies token but does not itself recheck member status | Medium | Recheck `active` status inside `memberProcedure`, as staff middleware already rechecks active state. This prevents a deactivated member token from accessing portal procedures until expiry. |
| Staff loyalty detail, purchases, and ledger procedures need explicit location/relationship review | Medium | Confirm staff access is constrained to the member's joined or transactional location scope where business policy requires it. Add direct regression tests for unauthorized member detail, purchase, and points access. |
| No dedicated application event/audit log is evident | Medium | Add an immutable `auditEvents` stream for authentication outcomes, staff administration, adjustment, transfer, price/stock configuration, voids, exports, and integration results. Keep tokens, passwords, and sensitive values out of logs.[6] |
| No evidence of independent security scanning or dependency gate | Medium | Add automated dependency audit/SBOM, secrets scanning, SAST, and periodic ASVS-aligned review. OWASP ASVS is designed as a structured basis for verifying web-application security controls.[4] |

## Target architecture for the next stage

The current managed stack should remain in place. A rewrite is not recommended. The better path is to preserve the stable transactional core and introduce domain boundaries and integration reliability around it.

```text
React staff workspace        React member portal
          │                         │
          └──────────── tRPC API boundary ────────────┐
                                                     │
                Domain routers and services         │
 Auth │ Catalog │ Inventory │ Sales │ Loyalty │ Reports │ Administration
                                                     │
                        Drizzle transaction layer    │
                                                     │
               Managed MySQL/TiDB (system of record) │
                                                     │
                    Transactional outbox / audit events
                                                     │
       Payment adapters │ BIR EIS adapter │ Notifications │ Analytics/export
```

The **system of record** remains the transactional SQL database. A completed sale writes the accounting-relevant domain facts and an outbox event in one database transaction. Provider communication, EIS transmission, notifications, and noncritical analytics run later from the outbox with retry and idempotency. This avoids the failure mode where checkout either blocks on a third party or completes locally without a reliable way to recover missed external work.

## UI and visual design roadmap

### Maintain the current strengths

Retain the deep tindahan-green palette, lime emphasis, clear form density, and split public-entry composition. The visual style already signals calmness and operational trust. Keep the staff/member distinction because it reduces role confusion.

### Create a more ownable retail system

The design should evolve from “polished SaaS” into **premium Philippine retail operations software**. Build a lightweight design system around four reusable motifs: receipt lines, register keys, inventory-grid dots, and loyalty stamps. These can be expressed as subtle background patterns, section headers, QR-card containers, activity chips, and empty states without adding visual noise.

| Surface | Recommended redesign | Expected result |
|---|---|---|
| Staff shell | Add a dense “shift command bar” showing location, register, cash-session state, connectivity, and quick actions. | Cashiers and managers understand the operating context before acting. |
| Register | Prioritize barcode/search input, item scan feedback, cart focus, tender keypad, quick-payment buttons, and a high-confidence checkout review. | Faster transaction flow with fewer errors. |
| Inventory | Replace long control blocks with a stock-health summary, exception queue, and progressive details drawer. | Managers see shortages and action items before forms. |
| Transfers | Use a timeline/status rail with source, in-transit, destination, and exception states. | Transfers become easier to reason about across locations. |
| Reports | Add date controls, visible location scope, chart/table toggle, and “what changed since yesterday” cards. | Reports answer a management question rather than merely listing metrics. |
| Loyalty portal | Use a card-like balance hero, progress toward next reward, a stronger QR wallet visual, and plain-language activity labels. | Members more easily understand earned points and trust the balance. |
| Accessibility | Formalize focus states, 44px minimum touch targets where possible, status text that does not rely only on color, keyboard scan/checkout behavior, and readable table alternatives on mobile. | Better usability for counters, tablets, and assistive technologies. |

## Compliance and fiscal design notes

Philippine invoicing rules and implementation details should be confirmed for the actual merchant. The application should not claim BIR compliance today. The BIR EIS portal confirms an Electronic Invoicing/Receipting and Sales Reporting environment and API/sales-transmission operation for relevant taxpayers.[1] Current guidance on invoicing after the Ease of Paying Taxes changes emphasizes invoices as the primary sales document and describes specific transitions for CRM/POS and electronic software.[2]

The planned fiscal layer should support, at minimum, merchant legal name, TIN/VAT state, registered branch/device identity, invoice label, tax treatment, immutable line/tax snapshots, approved document numbering, void/credit linkage, and a versioned compliance configuration. Historic POS rules also emphasize branch identification, transaction amount, date, receipt numbering, and auditability.[3]

## Suggested delivery sequence

| Horizon | Focus | Deliverables |
|---|---|---|
| 0–30 days | Production readiness | Live credentialed acceptance matrix, audit event design, rate limits, member-status check, explicit staff-to-member scope tests, CI quality gates, BIR compliance discovery. |
| 31–90 days | Retail operations | Returns/exchanges, cashier override approval, cash close controls, suppliers/receiving, cycle counts, reports with ranges/exports, initial payment-adapter interface. |
| 3–6 months | Integrations and scale | First live payment provider, EIS outbox adapter, reconciliation dashboard, notification workflow, analytics aggregates, richer loyalty rules. |
| 6–12 months | Resilience and platform | Offline-first pilot, multi-device/register telemetry, warehouse replenishment, advanced loyalty campaigns, and a broader design-system rollout. |

## Live acceptance matrix still required

The following checks were not executed during this audit because temporary credentials were unavailable. They are the final evidence required before a production rollout.

| Role | Scenario | Evidence to retain |
|---|---|---|
| Admin | Login, staff profile edit, menu assignment, branch activation/deactivation, and report scope | Screenshots, resulting database record, and audit event |
| Cashier | Open session, scan/search, cash and non-cash mock checkout, receipt retrieval, logout/expiry | Receipt number, payment result, inventory delta, and session state |
| Manager | Product/stock adjustment, transfer request/ship/receive, cash close, report review | Movement IDs, transfer timeline, cash variance, and report output |
| Loyalty member | Enrollment, QR lookup in checkout, points earning, portal balance/history, logout | Member number, ledger entry, receipt points detail, and cleared token/session |

## References

[1]: https://eis.bir.gov.ph/ "BIR Electronic Invoicing/Receipting System"
[2]: https://www.pwc.com/ph/en/tax/tax-publications/taxwise-or-otherwise/2024/compliance-change-on-invoicing-under-eopt.html "PwC Philippines: Compliance change on invoicing under EoPT"
[3]: https://elibrary.judiciary.gov.ph/thebookshelf/showdocs/10/47969 "BIR Revenue Regulations No. 10-99: Rules on use of cash register and POS machines"
[4]: https://owasp.org/www-project-application-security-verification-standard/ "OWASP Application Security Verification Standard"
[5]: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html "OWASP Session Management Cheat Sheet"
[6]: https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html "OWASP Logging Cheat Sheet"
