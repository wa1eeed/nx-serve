# 01. Product and Business Model

## 1. Vision

A Saudi-built engine that lets anyone launch a professional on-demand or scheduled service
business (towing, moving, AC maintenance, cleaning, mobile car wash, home services, consultations)
in days instead of months, under their own brand, with compliant payments, live tracking and a
developer API, and without writing code.

## 2. Who pays whom

```
                 licence (flat / per provider / per order / % GMV)
   Tenant  ───────────────────────────────────────────────────────▶  NX
   (white-label owner)

   Customer ──pays order──▶ Moyasar ──split──▶ Provider (net of fees)
                                     └─split──▶ Tenant platform fee
                                     └─fee────▶ Moyasar processing fee (from fee_source split)

   Provider ──membership (optional)──▶ Tenant   (offset from earnings, card on file, or invoice)
```

- NX never touches order money. Tenants receive their platform fee directly from Moyasar.
- NX licence fees are billed to tenants separately (NX acts as a normal merchant for its own
  subscription revenue).

## 3. Personas

| Persona | Needs |
|---|---|
| **Entrepreneur / tenant owner** | Launch fast from a template, brand it, set prices and fees, onboard providers, see revenue. |
| **Tenant ops staff** | Live map, dispatch override, disputes, provider approvals, support. |
| **Provider company (fleet)** | Web portal: agents, assets, assignments, documents, settlements, reports. |
| **Field agent / freelancer** | Simple app: go online, accept, navigate, update stages, proof, earnings. |
| **Customer** | Request in seconds, clear price, trust (tracking, ratings), easy payment. |
| **Developer / integrator** | Clean API, sandbox, docs, webhooks, SDK, Postman collection. |
| **NX staff** | Manage tenants, plans, templates, global catalogs, health, billing. |

## 4. Positioning against generic "Uber for X" scripts

1. **True configuration**, not a code fork per client: templates + engine.
2. **Saudi-native compliance**: Moyasar split payments (no pooled funds), ZATCA invoices, Nafath,
   NX Verify KYB, Arabic-first RTL, data residency (SCCC).
3. **Developer platform** comparable to global infrastructure players.
4. **Proven by our own operation**: NX runs its towing brand on the same engine.

## 5. Go-to-market principles

- Sell **templates as products** ("launch a towing platform this week"), not "a configurable
  platform". Each template gets its own landing page.
- Keep three public plans simple; complex combinations are for enterprise deals.
- Reseller tenant group for partners who sell licences in other cities or GCC countries.
- Towing first in Riyadh with our own brand: 10 to 15 pre-signed providers before launch (Moyasar
  requires 10 merchants to go live).

## 6. Success metrics

- Time for a tenant to go from signup to first paid order.
- Number of verticals launched with zero code.
- Order completion rate, average dispatch time, ETA accuracy.
- Dispute and chargeback rate (the agreement makes us liable as platform).
- Tenant retention, net revenue retention, licence MRR.
