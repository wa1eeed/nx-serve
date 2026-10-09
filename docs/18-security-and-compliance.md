# 18. Security and Compliance

## 1. Application security

- OWASP ASVS level 2 as the baseline checklist; OWASP API Security Top 10 reviewed per release.
- AuthN: OTP with rate limits and device binding; staff passwords (argon2id) + mandatory TOTP MFA
  for admin roles; refresh token rotation with reuse detection; session revocation.
- AuthZ: entitlement + permission guards on every endpoint; object-level checks; RLS as the
  last line of defence.
- Input validation by contracts; output encoding; CSP and security headers on web apps.
- Secrets in environment / KMS only; no secrets in repo, images or logs; log redaction of PII,
  tokens, card data.
- Dependency scanning, SAST, container scanning, SBOM in CI; signed images.
- Webhook verification (inbound) and signing (outbound); replay protection.
- File uploads: type/size validation, malware scan hook, private buckets, signed URLs.
- Admin impersonation: explicit, time-boxed, reason required, fully audited, visible to tenant.

## 2. Payments compliance

- PCI DSS scope minimised: card data only in Moyasar hosted form/SDK; we store tokens and
  masked data only.
- SAMA: no holding of third-party funds, no stored value, splits direct to recipients.

## 3. PDPL (Saudi Personal Data Protection Law)

- Data inventory and purpose per field (location, phone, vehicle plate, photos, IDs).
- Consent and privacy notices per tenant (tenant is controller for its customers; NX is processor);
  data processing agreement in the tenant licence.
- Data minimisation: providers do not see customer phone numbers by default; masked contact.
- Retention: tracking points and media deleted or anonymised after configurable periods; financial
  records retained per law.
- Data subject rights: export and deletion workflows.
- Production data hosted in KSA (SCCC).
- Breach response runbook.

## 4. ZATCA

E-invoices for: NX licence invoices to tenants, tenant platform fee invoices to providers or
customers (per VAT model decision, docs/16 Q14), provider membership invoices. Implemented via
`EInvoicingProvider` with QR codes and clearance/reporting per Phase 2 requirements.

## 5. Sector requirements

- Towing providers: TGA-related licences configured as category requirements with expiry tracking.
- Insurance partners (future): data sharing agreements and API scopes.
