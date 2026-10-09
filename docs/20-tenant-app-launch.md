# 20. How a Tenant Launches and Customizes Its Apps

One codebase per app (`apps/customer-app`, `apps/provider-app`). Every tenant app is the same code
with a different **tenant manifest**. Most customization is **runtime** (fetched from the API, no
store release); a small set is **build-time** (needs a new binary).

## 1. Distribution modes

| Mode | Plan | What the tenant gets | Time to launch |
|---|---|---|---|
| **Web** | all plans | Customers order, pay and track on the tenant's storefront (own subdomain or domain). Providers and agents use the provider web app, installable as a PWA on their phones ("Add to Home Screen"). | Immediate |
| **Branded apps** | Advanced plan (`branded_apps` module) | Two separate store apps (customer + provider) under the tenant's name, icon and developer accounts, in addition to the web. | Days (store review) |

There is no shared NX container app. The Apps page is visible to all tenants: without the module it
shows an "Advanced plan" tag, a live preview of the apps with the tenant's branding, and an upgrade
button.

### Web limitations to communicate honestly (and design around)

| Topic | Web / PWA | Branded apps |
|---|---|---|
| Agent location in background | Browsers stop sending location when the screen is locked or the page is in the background. Mitigation: Screen Wake Lock during active tracking stages, foreground reminders, ETA based on last known position. | Continuous background location. |
| New offer alerts to agents | Web push works on Android browsers and on iOS 16.4+ only for PWAs added to the Home Screen. Mitigation: SMS fallback for offers, longer offer timeouts for web agents (setting). | Native push, reliable. |
| Discovery | SEO pages, links, QR codes. | App Store and Google Play presence. |
| Payment | Moyasar web form; Apple Pay on the web needs each tenant domain registered with Moyasar (Apple Pay domains API). | Native Apple Pay / Samsung Pay per Moyasar SDK support. |

These limitations are also the natural reason to upgrade, especially for towing (full-trip tracking).

## 2. What can be customized

| Runtime (instant, no release) | Build-time (new binary) |
|---|---|
| Colors and theme tokens, light/dark | App name and short name |
| Logo inside the app | App icon, adaptive icon |
| Services, categories, tiers shown | Splash screen |
| Order fields, stages, texts | Bundle ID / package name |
| Prices, fees, promo banners | Permission descriptions (location, camera, notifications) |
| Home screen sections (services grid, banners, offers, recent orders) | Native SDK keys (maps, push, Apple Pay merchant id) |
| Languages enabled, legal pages, support contacts | Deep link domains (universal links / app links) |
| Notification texts | Minimum OS versions |

## 3. Branded app wizard (tenant console > Apps)

Same steps for the customer app and the provider app.

1. **Identity**: app name (ar/en), short name, bundle ID / package (suggested
   `sa.<slug>.customer`, `sa.<slug>.provider`).
2. **Visuals**: icon (1024x1024 PNG), adaptive icon foreground/background, splash image and
   background color, theme tokens. Live preview of the app in the browser (phone frame).
3. **Store listing**: descriptions (ar/en), keywords, category, privacy policy URL (auto-generated
   legal pages available), support URL and email, screenshots (generated automatically from the
   tenant theme, replaceable).
4. **Features**: services and languages to enable (limited by entitlements), login methods,
   payment methods (Apple Pay needs the tenant's Apple merchant id and domain verification with
   Moyasar).
5. **Developer accounts** (the tenant owns them):
   - Apple Developer Program, organization account (needs a D-U-N-S number). The tenant creates an
     App Store Connect API key (issuer id, key id, .p8) with App Manager role and pastes it in.
   - Google Play Console (organization). The tenant creates a service account with release
     permissions and uploads its JSON key.
   - Push: APNs via the Apple key; FCM project created by our pipeline or provided by the tenant.
   Credentials are stored in the secrets manager, referenced by `tenant_apps.store_accounts`.
6. **Build**: the worker generates the tenant manifest, triggers EAS Build (iOS + Android) with
   profile `tenant`, records `app_builds`, and shows progress and logs.
7. **Test**: build goes to TestFlight and Google Play internal testing; the tenant installs and
   checks it.
8. **Submit**: one click submits for store review; status tracked (in_review, live, rejected with
   reason and guidance).

## 4. Why the tenant's own developer accounts

Apple App Review Guidelines (4.2.6 in recent versions) reject apps created from a commercialized
template or app generation service unless submitted directly by the provider of the app's
content. Publishing under each tenant's own account is therefore required. It also gives the
tenant full ownership of its store presence, reviews and customer relationship.

## 5. Provider app specifics

- Background location requires clear permission texts (generated, editable) and, on Google Play,
  a background location declaration with a short demo video (template provided in the wizard).
- Optional private distribution: Apple unlisted app distribution and Google Play closed tracks
  for providers only, if the tenant prefers the provider app not to be publicly searchable.

## 6. Updates after launch

- **JavaScript and asset updates**: EAS Update channel per tenant; NX releases an update, tenants
  receive it automatically (or after approval per setting).
- **Native updates** (new SDK, OS requirements): NX pipeline rebuilds all branded apps in batches
  and submits them; tenants are notified; builds use stored credentials.
- Version policy: minimum supported app version per tenant; forced update screen when needed.

## 7. Technical design

- `app.config.ts` reads `TENANT_SLUG` and fetches the tenant manifest from the API at build time
  (name, ids, icons, permissions texts, deep link domains, SDK keys).
- At runtime the app calls `GET /v1/app/bootstrap` (tenant theme, enabled services, home sections,
  locales, feature flags, minimum version), cached with ETag.
- Provider PWA: the same provider-app code exported with Expo web, served at
  `https://<tenant-domain>/partners` (or the provider_portal domain), with web manifest, service
  worker, Web Push (VAPID) and Screen Wake Lock during tracking stages. Tenant resolved by host.
- Customer accounts are per tenant (the same phone number can exist in several tenants).
- Data: `tenant_apps` (mode, ids, theme, store accounts, status), `app_builds` (platform, version,
  build number, EAS id, status, logs).

## 8. Costs to communicate to tenants

Apple Developer Program annual fee and Google Play one-time registration are paid by the tenant.
EAS build minutes and update bandwidth are covered by NX within plan limits (`branded_app_pairs`
and build quotas).
