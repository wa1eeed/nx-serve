# 24. Internationalization, Arabic Quality and Typography

## 1. Language policy

| Layer | Language |
|---|---|
| Code, identifiers, DB objects, enums, API fields, error codes, logs, comments, docs, commits | English only |
| Source i18n catalog | `en` (keys are English, namespaced: `orders.cancel.confirm_title`) |
| Shipped UI locales at launch | Arabic (`ar`) and English (`en`), **100% parity enforced in CI** |
| Tenant default locale | Setting per tenant (Saudi tenants default to `ar`) |
| Future locales | Added by catalogs + translatable content, no code change (e.g. `fr`, `ur`, `tr`) |

## 2. Arabic as a first-class language (not a translation)

- **Native copywriting**: Arabic copy is written by a professional Arabic UX writer from the same
  brief as English, not translated word by word. Modern Standard Arabic with a friendly Saudi tone;
  short, direct, active voice. English and Arabic may differ in wording when that reads better.
- **Glossary** (`packages/i18n/glossary.md`): fixed terms (e.g. order = طلب, provider = مزود
  الخدمة, agent = المنفذ/السائق, tier = فئة الخدمة, split = تقسيم الدفعة, capture = تأكيد الخصم,
  authorization = حجز المبلغ). Every key uses the glossary; reviewers check consistency.
- **ICU MessageFormat** everywhere: Arabic plurals have six forms (zero, one, two, few, many,
  other); gender select where the UI addresses the user; no string concatenation.
- **Designed RTL**, not only mirrored: review every screen in RTL for alignment, icon direction,
  progress direction, charts axis, swipe gestures, and number placement.
- **Bidirectional text**: phone numbers, plates, order references, amounts, emails and URLs are
  isolated (`<bdi>` / `unicode-bidi: isolate`, RN `writingDirection`) so they never break.
- **Digits**: Western digits (0 to 9) by default for clarity in Saudi digital products; tenant
  setting to use Arabic-Indic digits in Arabic UI. Number, date and currency formatting via `Intl`
  with the active locale (`ar-SA`, `en-SA`, `en-US`...).
- **Currency**: SAR shown with the official Saudi Riyal symbol where the font supports it, with an
  SVG/icon fallback, or the "ر.س" / "SAR" text per setting.
- **Dates**: Gregorian default; optional Hijri (Umm al-Qura) display via `Intl` calendar; relative
  times ("قبل 5 دقائق") via `Intl.RelativeTimeFormat`.
- **No letter-spacing on Arabic** (it breaks letter joining), no italics for Arabic emphasis (use
  weight or color), no all-caps logic applied to Arabic.
- **Quality gates**: CI fails on missing keys, unused keys, ICU syntax errors; pseudo-localization
  run for overflow; screenshot tests per key screen in `ar` and `en`; native-speaker review
  checklist before each release.

## 3. Fonts

| Use | Arabic | Latin |
|---|---|---|
| Default UI and content | **IBM Plex Sans Arabic** (400, 500, 600, 700) | **IBM Plex Sans** (same weights) |
| Optional tenant choices | Tajawal, Noto Kufi Arabic, Cairo, Readex Pro | matched Latin pairing per font |
| Code / numbers in tables | IBM Plex Mono (tabular figures) | IBM Plex Mono |

Why IBM Plex Sans Arabic by default: designed for interfaces, very legible at small sizes, a full
weight range, and a sister Latin family with matched proportions, so mixed Arabic/English lines
(very common in our UI: brands, car models, plates) look consistent. Tajawal remains available
and can be the default by changing one design token.

Implementation: self-hosted WOFF2 subsets (Arabic + Latin), `font-display: swap`, preload the
regular and semibold weights only, variable fonts where available; mobile bundles the same files
via `expo-font`. All fonts used are under the SIL Open Font License.

## 4. Type scales

Arabic glyphs look smaller than Latin at the same size; Arabic styles use the same size steps with
**larger line heights** (about 1.6 to 1.8) and, for body text below 16 px, one step up.

### 4.1 Web: storefront, marketing, customer account (mobile-first)

| Token | Size / line height (Latin) | Arabic line height | Use |
|---|---|---|---|
| display | clamp(36px, 5vw, 60px) / 1.1 | 1.3 | Marketing hero |
| h1 | 32px (mobile 28px) / 1.2 | 1.4 | Page title |
| h2 | 24px / 1.3 | 1.5 | Section title |
| h3 | 20px / 1.4 | 1.6 | Card title |
| lead | 18px / 1.6 | 1.8 | Intro paragraph |
| body | **16px** / 1.5 | 1.7 | Default text, all inputs (16px minimum avoids iOS zoom) |
| small | 14px / 1.45 | 1.6 | Secondary text, meta |
| caption | 12px / 1.4 | 1.5 | Labels, legal; never smaller than 12px |

Line length 60 to 75 characters for Latin, 50 to 70 for Arabic.

### 4.2 Web consoles (super admin, tenant console, provider portal: dense)

| Token | Size / line height | Use |
|---|---|---|
| page-title | 24px / 32px | Page header |
| section-title | 18px / 28px | Panels |
| body | **14px** / 20px (Arabic 22px) | Default console text, forms |
| table | 14px / 20px (13px for very dense grids) | Data tables, tabular figures |
| label | 13px / 18px, weight 500 | Field labels, chips |
| caption | 12px / 16px | Hints, timestamps |

### 4.3 iOS (Apple Human Interface Guidelines, points)

| Style | Size / leading | Use |
|---|---|---|
| Large Title | 34 / 41 | Screen titles (home, orders) |
| Title 1 / 2 / 3 | 28 / 34, 22 / 28, 20 / 25 | Headers, tier cards price |
| Headline | 17 semibold / 22 | Row titles, buttons |
| Body | **17** / 22 | Default text |
| Callout | 16 / 21 | Supporting text |
| Subheadline | 15 / 20 | Secondary rows |
| Footnote | 13 / 18 | Meta |
| Caption 1 / 2 | 12 / 16, 11 / 13 | Badges only |

### 4.4 Android (Material Design 3, sp)

| Role | Size / line height | Use |
|---|---|---|
| Display small | 36 / 44 | Rare, onboarding |
| Headline medium / small | 28 / 36, 24 / 32 | Screen titles |
| Title large / medium | 22 / 28, 16 / 24 (500) | App bars, card titles |
| Body large | **16** / 24 | Default text |
| Body medium | 14 / 20 | Secondary |
| Label large / medium | 14 / 20, 12 / 16 (500) | Buttons, chips |

React Native maps these to platform-specific tokens (`Platform.select`) so each OS feels native.

### 4.5 Provider app (used in vehicles, sunlight)

One step larger than the platform defaults for primary content (e.g. iOS body 19, Android body 18),
primary action buttons at least 56 pt/dp tall, high contrast theme, key numbers (ETA, price,
distance) at title sizes.

## 5. Weights, accessibility and scaling

- Weights: 400 body, 500 labels and buttons, 600 headings, 700 display and key numbers. Avoid
  weights below 300, especially in Arabic.
- Contrast: WCAG 2.1 AA minimum (4.5:1 text, 3:1 large text and UI components).
- Touch targets: 44 x 44 pt (iOS), 48 x 48 dp (Android), 44 x 44 px on mobile web.
- Respect user font scaling: Dynamic Type (iOS) and font scale (Android) supported; layouts tested at
  200%; `maxFontSizeMultiplier` limited only on fixed elements (tab bars, badges). Web uses `rem`
  so browser zoom and font settings work.

## 6. Country packs (global readiness)

A country pack bundles everything country-specific; Saudi Arabia is the first:

| Item | Saudi pack |
|---|---|
| Currency | SAR (exponent 2) |
| Tax | VAT 15% rules |
| Payment gateway | Moyasar (mada, cards, Apple Pay, STC Pay) |
| E-invoicing | ZATCA |
| Identity | Nafath, NX Verify |
| Phone | +966, E.164 validation |
| Address | Saudi National Address format |
| Units / calendar | km, Gregorian + optional Hijri |
| Legal templates | PDPL privacy notice, Saudi consumer terms |
| Data residency | KSA (SCCC) |

Adding a country later means implementing its pack (gateway adapter, tax rules, e-invoicing,
identity, templates) behind the same interfaces, with no change to core engines.
