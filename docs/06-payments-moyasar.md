# 06. Payments with Moyasar

Read the private references in `reference/private/moyasar/` and the Platform docs
(https://docs.moyasar.com and the preview at https://platform-docs-bzl.pages.dev). Verify every
endpoint and field against the live docs and the sandbox before relying on it; items below marked
**[verify]** are not yet confirmed.

## 1. Commercial context (draft agreement, not yet signed)

- Model in the draft: **Platform revenue sharing**. Moyasar keeps processing fees, deducts its
  operating costs, and shares net revenue **70% Moyasar / 30% NX**, invoiced quarterly by NX.
- Processing fees (Appendix B): mada 0.85% capped at 200 SAR; local Visa/Mastercard 2%;
  international 3%; STC Pay 1% (optional); Amex 3.75% (optional); activation 250 SAR per merchant
  for each optional method. VAT 15% is added on fees.
- Setup fee 5,000 SAR; 10 merchants ready before launch; chargebacks: platform primarily liable,
  200 SAR per chargeback, documents within 3 business days.
- Settlement: Monday and Thursday, minimum 100 SAR; daily settlement 4 SAR per settlement; instant
  transfer 10 SAR. Refund time: mada 24 h to 3 days, cards 7 to 14 business days.
- Under negotiation (see docs/16): Split Payments activation, split fees outside the 70/30 pool or
  a reseller buy-rate model, settlement directly to merchants (clause 1.2), mutual
  non-circumvention, white-label display rights, referral fee inconsistency.

## 2. Merchants (provider orgs)

- Each provider org is created as a Moyasar merchant (entity) through the Platform API, with KYC
  documents per entity type (`required_documents` from the API), signed by the merchant via
  **Nafath**. Statuses to mirror: `pending, missing_docs, semi_active, active, hold, rejected,
  disabled` (+ our `draft, submitted`). Webhooks update status.
- Each merchant has its own fee matrix, set by us via the API (`fees` object): per method
  `*_charge_rate`, `*_charge_fixed`, `*_charge_cap` (mada cap must stay 200.00), refund rates/fixed,
  `settle_transfer_rate/fixed`, `tax_inclusive`. Merchant fee changes are subject to the agreement
  (clause on pricing approval) **[verify]**.
- We run NX Verify checks before submission to reduce rejections.

## 3. Split Payments

Facts from the Platform docs:
- Available **only for aggregation clients**, not facilitation (bank merchant) model, and enabled
  per platform by the account manager.
- Recipients: `Entity` (the merchant, recipient id = `entity_id`), `Platform` (our platform id),
  `Beneficiary` **[verify semantics]**.
- Payment create accepts `splits: [{ recipient_id, amount, reference?, description?,
  fee_source?, refundable? }]`. Amounts in halalas.
- Rules: splits total = payment amount; zero or one `fee_source` (if none, merchant's highest split
  is used); recipients must be valid; a Platform recipient must be the **parent platform of the
  merchant**; negative splits allowed (absolute negative sum <= payment); entity splits cannot be
  negative.
- Refund and void reverse all splits by default. `refundable: false` keeps that split on refund
  (the remainder is deducted from the merchant). **Void always reverses all splits.**
- Negative platform split funds discounts (promo codes); platform balance may go negative.
- Reseller model: Moyasar charges the platform a buy rate; platform sells a higher rate to the
  merchant; the system adds an automatic split with the margin.

## 4. Our order payment flow

```
estimate ──▶ order created ──▶ provider assigned ──▶ AUTHORIZE (amount = estimate + buffer,
                                                       splits = provider + platform fee)
   ... stages ...  ──▶ completion stage ──▶ CAPTURE (final <= authorized)
   cancellation with fee ──▶ PARTIAL CAPTURE (fee only)  |  no fee ──▶ VOID
   after capture ──▶ REFUND (full/partial; platform split refundable per fee config)
```

- **When to authorize**: after assignment, because splits name the provider's entity. If Moyasar
  confirms that splits can be set or changed at capture **[verify]**, authorize at order time
  under the platform and set splits at capture.
- **Card storage**: tokenize at order time so the authorization can run when the provider accepts
  without the customer re-entering the card. 3-D Secure flows must be handled in-app.
- **Authorization expiry** **[verify maximum]**: `payments.auth_expires_at`; a worker job alerts
  ops and the provider before expiry and voids or re-authorizes per policy.
- **Final amount > authorized** (extra work): create a **supplementary payment** (`purpose =
  supplement`) that the customer approves in-app.
- **Split computation** lives in `packages/domain/splits` and is property-tested: for any order,
  sum(splits) == amount, provider split >= 0, at most one fee source.

### Worked example (from design sessions)

Customer pays 100 SAR, platform fee 10% (10 SAR). Moyasar fee with VAT: mada 0.98, local card 2.30.

| Fee source | Provider receives (mada / card) | Platform receives (mada / card) | Platform net after VAT on its 10 SAR fee (1.30) |
|---|---|---|---|
| Provider | 89.02 / 87.70 | 10.00 / 10.00 | 8.70 / 8.70 |
| Platform | 90.00 / 90.00 | 9.02 / 7.70 | 7.72 / 6.40 |

The 30% revenue share is negligible on small mada orders (Moyasar's fixed per-transaction fraud
cost exceeds the fee). Business revenue comes from the split fee.

## 5. Webhooks and reconciliation

- Verify webhook authenticity per Moyasar docs **[verify mechanism]**; store in `webhook_events`
  (unique event id); process in worker; idempotent.
- Daily reconciliation: payments, captures, refunds, splits and settlement files vs our ledger;
  mismatches create ops tasks.

## 6. Hard rules

1. No pooled funds, no wallets, no stored customer balance.
2. No raw card data in our systems or logs.
3. No surcharging by card type for customers.
4. Every gateway call has an idempotency key and a timeout + retry policy.
5. Chargeback workflow: notify provider and ops, collect evidence (photos, OTP logs, tracking,
   signatures) automatically from the order, submit within 3 business days, track outcome.

## 7. Multi-tenant gateway modes

- `own_platform` (recommended): the tenant signs its own platform agreement with Moyasar and
  enters credentials in its console (stored in secrets manager, referenced by `credentials_ref`).
  The tenant is the parent platform of its providers and receives its fee splits directly.
- `nx_master`: tenants under NX's platform. Only if Moyasar confirms a compliant way for tenant
  fees to reach tenants directly (e.g. Beneficiary recipients). Otherwise NX would hold tenant
  money, which is not allowed.

## 8. Out of scope: in-person payments

SoftPOS (e.g. NearPay) transactions settle through the sponsoring acquirer, not Moyasar, so Split
Payments do not apply. Revisit only if Moyasar offers card-present acceptance with splits.
