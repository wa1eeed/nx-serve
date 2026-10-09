# @nxserve/integrations

External systems behind interfaces, each with a fake for local dev and tests (docs/03). Nothing in
the core engines names a vendor, so a provider can be swapped per country pack and per tenant.

## Adapters

| Interface | Real adapter (later phases) | Fake |
|---|---|---|
| `PaymentGateway` | Moyasar (after Split Payments addendum, docs/16) | `FakePaymentGateway` enforces split balance and capture <= authorized |
| `MapsProvider` | Google Maps Platform | `FakeMapsProvider` (routed distance approximation) |
| `NotificationProvider` | Expo push, SMS, WhatsApp, SMTP | `ConsoleNotificationProvider` |
| `StorageProvider` | MinIO / Alibaba OSS | `FakeStorageProvider` (in memory) |
| `IdentityVerifier` | NX Verify | `FakeIdentityVerifier` |
| `NationalIdentity` | Nafath | `FakeNationalIdentity` |
| `EInvoicingProvider` | ZATCA | `FakeEInvoicingProvider` |
| `RegulatoryFilingProvider` | TGA e-waybill etc (docs/16 Q21) | `FakeRegulatoryFilingProvider` |

`createIntegrations(env)` selects the set; in Phase 0 it returns all fakes, keeping payments off and
the gateway replaceable. The split invariants (`assertSplitsBalance`) and the constant time webhook
secret check live here so every adapter shares them.

## Events emitted / consumed

None directly; adapters are called by application services.
