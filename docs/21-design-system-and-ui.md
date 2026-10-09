# 21. Design System and UI Libraries

## 1. Decision

| Layer | Choice |
|---|---|
| Web components | **shadcn/ui** (Radix UI primitives + Tailwind CSS v4), code copied into and owned by `packages/ui-web` |
| Data-heavy screens | TanStack Table + TanStack Virtual (virtualized grids), shadcn data-table patterns, column pinning, filters, saved views, export |
| Forms | react-hook-form + Zod (same schemas as API contracts and the dynamic form engine) |
| Charts | shadcn charts (Recharts) styled by tokens |
| Feedback / command | sonner (toasts), cmdk (command palette for consoles) |
| Mobile components | **NativeWind** + **React Native Reusables** (shadcn-style RN components) in `packages/ui-native` |
| Icons | lucide (web) and lucide-react-native (mobile), same names |
| Maps | Provider-agnostic map wrapper; Google Maps first (docs/03) |

## 2. Why not the others

| Library | Reason not chosen |
|---|---|
| MUI | Strong Material (Google) visual identity that every tenant's brand would fight against; heavier runtime styling; deep re-theming is costly. |
| Ant Design | Excellent density, but a distinct enterprise look, large bundle, and theming per tenant at runtime is harder; its strengths (tables, forms) are covered by TanStack Table + react-hook-form. |
| Chakra UI | Good DX and accessibility, but smaller momentum and major API shifts between versions; overlaps with shadcn without benefits for us. |
| DaisyUI | Semantic CSS classes only: no behaviour or accessibility primitives (dialogs, menus, comboboxes), which Radix provides. |
| Mixing several | Inconsistent UX, duplicated bundles, two theming systems. One system only. |

The deciding factor is **white-label**: shadcn/ui is unopinionated and token-driven, so each tenant's
brand can fully replace the look at runtime, and we own every component's code.

## 3. Tokens and tenant theming

- `packages/design-tokens`: colors (semantic: background, foreground, primary, secondary, accent,
  muted, destructive, success, warning, info, border, ring, chart-1..8), radius, spacing, typography
  scale, shadows, motion. Light and dark sets.
- Web: tokens become CSS variables. The tenant's branding (from settings) is injected server-side
  as a `<style>` with variable overrides on the root, so no rebuild is needed per tenant.
- Mobile: same tokens through NativeWind CSS variables / theme provider, loaded from
  `GET /v1/app/bootstrap`.
- Contrast guard: when a tenant picks brand colors, the console computes WCAG contrast and
  auto-derives accessible foreground colors, warning the tenant if a choice fails AA.

## 4. RTL and Arabic

- Arabic and English ship at full parity; the default locale is a tenant setting (Saudi tenants
  default to Arabic). Use logical CSS properties (`ms-`, `me-`, `ps-`, `pe-`, `start`, `end`)
  exclusively; `dir` set at the document root from the locale; Radix `DirectionProvider`.
- Directional icons (arrows, chevrons) mirror in RTL; numbers, plates and phone numbers render LTR
  inside RTL text.
- Fonts and type scales: see docs/24 (default IBM Plex Sans Arabic + IBM Plex Sans; Tajawal and
  others selectable by tenants).
- Dates: Gregorian by default with optional Hijri display; Asia/Riyadh timezone.

## 5. Surfaces and density

| Surface | Style |
|---|---|
| Super admin, tenant console, fleet portal | Dense, keyboard-friendly, data tables, side navigation, command palette, saved filters |
| Storefront and customer flows | Mobile-first, large touch targets, minimal steps (Uber-like) |
| Provider PWA and app | Large controls for use in vehicles and sunlight, high contrast, one primary action per screen |
| Developer portal | Documentation layout, code blocks with copy, language tabs |

## 6. Mobile apps: same identity, native experience

- The mobile apps are **truly native**: React Native renders real iOS and Android components, not
  a web page inside the app. They share the brand identity with the web (tokens, fonts, icons,
  naming, tone), not the web layouts.
- Native patterns: stack navigation with swipe-back, bottom tabs, bottom sheets for tier cards and
  order details (Uber-like), native date/time pickers, haptics, pull to refresh, skeleton
  loading, offline states, native maps and gestures.
- Platform conventions respected where users expect them (iOS vs Android back behaviour, share
  sheets, permission prompts, typography rendering).
- The provider PWA is the provider app exported to the web (Expo web), so it looks like the app;
  native-only capabilities (background location, native push) degrade gracefully (docs/20).
- The customer web storefront follows the same flow as the customer app, implemented with web
  components (shadcn/ui), mobile-first.

## 7. Locked feature pattern

A shared `LockedFeature` component (web and mobile) renders gated features with a plan badge
("Advanced plan"), a one-line value statement and an upgrade CTA. Used everywhere entitlements
gate a feature (docs/10).

## 8. Quality

- Storybook for `ui-web` with RTL/LTR, light/dark and sample tenant themes; visual regression in CI.
- Accessibility: Radix semantics, axe checks in Playwright, WCAG 2.1 AA.
- No component library outside this system without an ADR.
