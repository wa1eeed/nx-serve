# 17. Backlog and Proposals

Claude Code adds proposals here (gaps found, improvements) with priority (P0 must for MVP, P1
before commercial launch, P2 later) and rationale. Initial list from the design sessions:

| Priority | Item | Rationale |
|---|---|---|
| P0 | Masked calling / in-app chat between customer and agent | Privacy (PDPL), prevents taking customers off-platform. |
| P0 | Chargeback evidence pack generated from order data | Platform is liable for chargebacks (200 SAR each). |
| P0 | Auth-expiry guard job | Prevent losing payment on long or scheduled jobs. |
| P0 | Reconciliation job with Moyasar | Financial correctness. |
| P0 | Audit log viewer in consoles | Accountability for pricing and approvals. |
| P1 | Corporate accounts (insurers, fleets) paying on monthly invoice | Large towing demand comes from insurers and fleets; requires careful money flow design (invoice paid via payment link or bank transfer to provider/tenant, never pooled). |
| P1 | Promo codes and referral credits funded by negative platform split | Growth; no wallet. |
| P1 | Scheduled bookings with deposit | Auth validity limits. |
| P1 | Provider earnings statements and tax documents | Trust and accounting. |
| P1 | Safety: SOS button, trip sharing link | Customer trust, especially for night towing. |
| P1 | Data export and account deletion (PDPL) | Compliance. |
| P1 | Status page and incident communication | API platform credibility. |
| P1 | Feature flags service (per tenant, per percentage) | Safe rollouts across tenants. |
| P2 | Quotes and negotiation UI | Moving and large jobs. |
| P2 | Dynamic surge | After scheduled surge proves acceptable. |
| P2 | Multi-stop routes, recurring services | New verticals (delivery, cleaning subscriptions). |
| P2 | OAuth marketplace for third-party apps | Ecosystem. |
| P2 | Reseller programme (tenant group with commissions) | Distribution channel. |
| P2 | Analytics warehouse and BI dashboards for tenants | Upsell module. |
| P2 | In-person payments if Moyasar offers card-present with splits | Franchise and branch use cases. |

## Findings from the Phase 0 kickoff review (2026-10-09)

Contradictions, gaps and risks found while reading every doc, the reference schema and the Moyasar
references, each with a proposed resolution. Infrastructure decisions are added to docs/16 (Q25, Q26).

### Contradictions and risks (payments)

| Priority | Finding | Evidence | Proposed resolution |
|---|---|---|---|
| P0 | The draft agreement contradicts the direct settlement model. Appendix A clause 1.2 says the First Party (Moyasar) collects and settles merchant funds and transfers the net to the Second Party (NX) after deducting fees, which means funds pool through NX. This breaks the no third-party funds rule and the SAMA position. The draft never mentions Split Payments. | agreement Appendix A 1.2 and Appendix B; vs API deck slide 15 "merchant proceeds settle directly to the verified bank account"; docs/06, docs/16 Q6, M7. | Treat all live payments as blocked until a signed Split Payments addendum confirms direct settlement to each merchant and rewrites clause 1.2. Build the full flow on sandbox behind a payments feature flag. Keep PaymentGateway as an interface so the gateway is replaceable. |
| P0 | The payment gateway must not be a hard dependency. Moyasar is one option and is adopted only after Split Payments is enabled; another gateway may be plugged in. | founder guidance 2026-10-09; docs/03 adapters; docs/24 country packs. | Gateway behaviour lives behind PaymentGateway in packages/integrations; the splits domain is gateway agnostic (sum == amount, one fee source, non negative entity splits). Moyasar is the first adapter, selected per country pack and tenant gateway mode. Nothing in core engines names Moyasar. |
| P1 | Merchant linking fee inconsistency: the legal Appendix B states 1 SAR per client switched, the API deck states SAR 100 per merchant. | agreement Appendix B; deck slide 9; docs/16 Q7. | Confirm the figure in the addendum. No code impact. |
| P1 | "Beneficiary" split recipient is ambiguous. The deck lists split recipients as Entity, Platform and eligible Beneficiary, but the live API uses Beneficiary for the separate Payouts product, and documented split recipient types are Entity and Platform only. | deck slide 15; docs.moyasar.com splits and payouts; docs/16 Q5. | Do not rely on nx_master via a Beneficiary split until Moyasar confirms it in writing. Default to own_platform. Keep recipient_type open in payment_splits. |
| P1 | Splits can be set at payment creation only; no evidence they can be set or changed at capture. mada authorization hold is about 14 days, general hold about 7 days. | docs.moyasar.com payment operations and manual payments; docs/16 Q3, Q4. | Authorize after provider assignment so the entity is known (default). Mandatory auth expiry guard job. Long or scheduled jobs use the deposit_then_balance or milestones payment plan (docs/25). |
| P1 | Inbound Moyasar webhooks are not HMAC signed. Moyasar echoes a shared_secret in the body; authenticity rests on a constant time token comparison plus IP allow list. Our outbound webhooks to tenants are HMAC signed (docs/11), a different direction. | docs.moyasar.com webhook reference and setup; docs/16 Q9. | Verify the shared secret in constant time, restrict source IPs, then always re fetch the payment from Moyasar by id before acting. Store events in webhook_events, process exactly once. Events: payment_authorized, payment_captured, payment_paid, payment_failed, payment_voided, payment_refunded, payment_verified, balance_transferred, card_auth_authenticated. |

### Gaps in the reference schema to resolve when writing migrations

| Priority | Gap | Proposed resolution |
|---|---|---|
| P0 | Global UNIQUE constraints must be tenant scoped: customers.mobile, provider_agents.mobile, verticals.code, provider_orgs.moyasar_merchant_id, webhook_events.event_id, vehicle_classes.code and similar. customers.mobile global even contradicts docs/20 (same phone may exist in several tenants). | Scope by tenant where appropriate: UNIQUE (tenant_id, mobile), UNIQUE (tenant_id, code). Scope webhook_events.event_id and moyasar_merchant_id per gateway account. The schema flags this at lines 710 to 712. |
| P0 | RLS policies define only a USING clause, do not set FORCE ROW LEVEL SECURITY, and use current_setting without missing_ok. staff_users, roles, role_permissions, permissions and user_role_assignments get no RLS. | Every tenant policy gets USING and WITH CHECK, FORCE ROW LEVEL SECURITY, current_setting('app.tenant_id', true); the app connects as a non owner role; the super admin uses a separate BYPASSRLS role. Decide RLS for staff and role tables. |
| P0 | Missing operational tables (docs/04 rules 11 to 13): audit_logs, outbox_events, idempotency_keys. | Create all three in the first migrations, partition audit_logs. |
| P0 | Money columns are numeric(12,2); identifiers are gen_random_uuid; text is name_ar/name_en. | Convert money to bigint minor units plus currency, keep fractional rates numeric with documented rounding, generate UUIDv7 in the app, and convert all tenant and NX authored text to one jsonb column shaped {"en","ar"} (ADR-0007, ADR-0013). Large delta done at migration time (no data to migrate). |
| P1 | tracking_points is partitioned by range but has no partitions, PK or indexes; order_events and audit_logs need monthly partitioning; hot relationships need composite (tenant_id, id) foreign keys. | Create default plus monthly partitions and retention jobs, add indexes, add composite foreign keys. |
| P1 | No auth tables: staff_users has no password hash, no OTP, no refresh or session tokens, no MFA secret; customers and agents have no credentials. | Add auth tables in Phase 0: argon2id plus TOTP for staff, OTP challenges for customers and agents, refresh tokens with rotation and reuse detection, device binding. |
| P1 | No disputes table although docs/07 and docs/23 describe disputes and order_status includes disputed; no Apple Pay domain storage per tenant domain (Q10b); no masked contact entities (P0 backlog). | Add a disputes table in Phase 4; Apple Pay fields on tenant_domains and masked contact when those features are built. |

### Capability blocks impact on the schema conversion (docs/25)

docs/25 adds capability blocks to the core and changes the validated schema. Cheap now, expensive to
retrofit, so they are reflected in the Phase 0 migrations even though behaviour lands in later phases.

| Priority | Item | Proposed resolution |
|---|---|---|
| P0 | Stops model (B1) replaces single origin and destination. The reference schema orders.origin and destination become derived from the first and last stop, with a new order_stops table (sequence, kind, location, masked contact, window, status, per stop proof, otp, items). This changes the validated design, so it needs an ADR. | Model orders around order_stops from the first migration, keep orders.origin and destination derived or removed, and record ADR-0014 (stops model and payment plans). Order engine behaviour stays in Phase 4; the shape lands in Phase 0 so nothing is retrofitted. |
| P0 | Payment plans (B2) generalise authorize and capture: payment_plans and payment_milestones bound to workflow stages (authorize_capture, prepay, deposit_then_balance, milestones, invoice, reimbursable_purchase; cash_on_delivery disabled by default pending Q23). milestones mitigates authorization expiry on multi day trucking. | Add both tables in Phase 0, keep the splits and milestones logic in packages/domain, default cash_on_delivery off behind a setting and legal review. |
| P1 | Business accounts (B5): customer_accounts, customer_account_users, account_rate_overrides for B2B invoice billing (docs/15: data model Phase 4, billing UI Phase 7). | Add the tables in the Phase 0 conversion so the invoice money flow fits without later migration churn; behaviour later. |
| P1 | Capacity matching (B3), document generation and filings (B4), scheduling windows (B6) are later phases but the fields and interfaces are reserved now. | Add capacity aggregate columns and a RegulatoryFilingProvider interface placeholder in the country pack; build behaviour when a template needs it. |
| P1 | Passenger transport pack (docs/25 section 6, Phase 9) needs dispatch scoring and presence pluggable and horizontally scalable, payment plans that authorize before assignment, and safety events as first class domain events. | Keep the dispatch and presence interfaces and the event outbox pluggable from Phase 0 so the pack fits without refactoring. No passenger code now. |

### Platform, security and ops proposals

| Priority | Item | Rationale |
|---|---|---|
| P0 | Enforce RLS with FORCE plus WITH CHECK, a non owner app role, and SET LOCAL app.tenant_id inside every transaction; document the PgBouncer transaction mode interaction. | Isolation is the first security guarantee; SET LOCAL is safe only inside a transaction and with transaction pooling. |
| P1 | Currency exponent helper and minor unit money helpers in packages/domain, property tested. | Correct money maths across currencies (SAR 2, KWD or BHD or OMR 3). |
| P1 | i18n parity CI gate from Phase 0 (ar and en at 100 percent), ICU validation, pseudo localization. | docs/24 requires it and it is cheap to enforce early. |
| P1 | Map common Postgres data-integrity error codes to problem+json in ProblemExceptionFilter: 23514 (check) and 23505 (unique) to 409, 23503 (foreign key) to 409, 22003 or 2200x (numeric or datetime cast) to 422. | Surfaced by the Phase 3 pricing review: a DB CHECK or overflow currently returns a raw 500 instead of a typed 4xx. Validation at the edge (Zod) covers the normal path; this is the backstop. Platform wide, so done deliberately with its own tests, not inside a feature commit. |
| P1 | App wide Fastify content type parser so an empty body with Content-Type application/json is treated as an empty object, returning the API problem+json shape rather than Fastify FST_ERR_CTP_EMPTY_JSON_BODY 400. | Surfaced by the Phase 3 pricing review on optional-body POSTs (approve, reject). Affects every POST, so it is a platform change with its own test, not part of a feature commit. |
| P1 | Partial unique index enforcing one active row per scope for rate_cards and fee_schedules (COALESCE based expression index over the scope key where status is active), as a DB backstop to the application level archive on approve. | Surfaced by the Phase 3 pricing review: the one active per scope invariant is currently enforced only in application code. |
| P2 | Durable maker-checker decision record for pricing (rejected_by, decided_at, decision, notes, or a dedicated approvals table) rather than only the transient outbox event payload. | Surfaced by the Phase 3 pricing review: approve and reject notes should be queryable for audit, not only in the event stream. |
| P2 | Scope PermissionsService.getPermissions by tenant_id, not only user_id (defensive; staff ids are unique per tenant today so not exploitable). | Surfaced by the Phase 3 pricing review. |
| P2 | Bound minor-amount string length in the shared MoneySchema or NonNegMinor so a value exceeding bigint range is a 422, not a Postgres bigint overflow 500. | Surfaced by the Phase 3 pricing review; shared primitive, so changed deliberately across the contract surface. |
| P2 | Gate the console pricing lifecycle buttons (submit, approve, reject, archive) on the viewer's permission and identity: fetch the current staff member's permissions (extend GET /me), hide approve or reject when the viewer lacks pricing.approve, and hide approve on a card the viewer created. | Surfaced by the Phase 3 console review: the server enforces this correctly (409 or 403), and CLAUDE.md says UIs only hide, so this is a dead-end-click UX improvement, not a correctness fix. |
