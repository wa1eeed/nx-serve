# ADR-0013: English code base, Arabic/English product at parity, global-ready via country packs

- Status: Accepted
- Date: 2026-10-09

## Context
The first market is Saudi Arabia and Arabic speakers, but the platform must be sellable worldwide.
Arabic must feel native, not translated.

## Decision
- All code artifacts and the source catalog are English.
- Ship `ar` and `en` at 100% parity (CI enforced), Arabic written natively with a glossary and
  ICU plurals; RTL designed per screen.
- Tenant content stored as translatable JSON, money as minor units with ISO 4217 currency.
- Country-specific behaviour (currency, tax, gateway, e-invoicing, identity, formats, legal,
  residency) isolated in country packs; Saudi pack first.
- Fonts: IBM Plex Sans Arabic + IBM Plex Sans by default, Tajawal selectable.

## Consequences
New languages and countries without core changes; extra discipline for copy quality and RTL
review; reference schema `_ar`/`_en` columns are converted to JSON during migration.

## Alternatives considered
Arabic-only code/content (blocks global growth); fixed `_ar`/`_en` columns (blocks more languages).
