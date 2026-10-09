# 22. Platform Marketing Site and Search Visibility (SEO, AEO, GEO)

The platform's public site sells **white-label licences** to entrepreneurs and companies. It is a
separate app: `apps/marketing` (Next.js, static generation + ISR, MDX content). Brand name: **NX Serve**.

## 1. Audience and goal

- Entrepreneurs who want to launch an on-demand service business (towing, logistics, home services).
- Existing service companies wanting their own app and platform (fleets, maintenance companies,
  insurers' service networks).
- Goal: book a demo or start a trial. Secondary: developer signups (API platform).

## 2. Information architecture

| Page | Purpose |
|---|---|
| Home | Promise, live demo visuals, use cases carousel, how it works, features, proof, pricing teaser, FAQ, CTA. |
| Use cases (one page per template) | Towing (first), logistics and last-mile delivery, moving, AC and home maintenance, cleaning, mobile car wash, vehicle inspection, home nursing and care visits (subject to regulation), consultations. Each: market pain, how the platform runs it (screens), pricing model example, launch time, FAQ. |
| Features | Configuration engine, live tracking, smart dispatch, Uber-style pricing, split payments with Moyasar, white-label web + apps, provider portal, customer account, API platform, analytics, compliance (ZATCA, PDPL, Nafath, KYB). |
| How it works | Signup, choose template, brand, connect payments, onboard providers, launch. |
| Pricing | Plans (Basic web, Growth, Advanced with branded apps, Enterprise), comparison table, FAQs on billing. |
| Developers | Link to developer portal, API highlights, Postman, SDK. |
| Resources | Blog, guides ("how to start a towing business in Saudi Arabia"), glossary, case studies. |
| Company | About NX Solutions, contact, partners/resellers programme, legal. |

Locales: Arabic (default, `/ar`) and English (`/en`), each with native copy, not machine translation.

## 3. Design standards

- Premium B2B SaaS look: strong hero with product visuals (real UI screenshots and an animated
  phone showing a towing order from request to delivery), clear single CTA per section.
- Built with the design system (docs/21), RTL-first, dark and light.
- Performance budget: LCP < 2.0 s on 4G mobile, INP < 200 ms, CLS < 0.05, JS < 150 KB on home.
- Accessibility WCAG 2.1 AA.
- Conversion: sticky CTA, demo booking form (CRM webhook), WhatsApp contact, calculator
  ("estimate your monthly revenue" from orders x fee), trust badges (Moyasar partner, SAMA-licensed
  gateway, ZATCA-ready, data hosted in KSA).

## 4. SEO (search engines)

- Server-rendered/static HTML for all content; no content hidden behind client-side JS.
- Per page: unique title and meta description per locale, canonical, `hreflang` (ar-SA, en,
  x-default), Open Graph and X cards with auto-generated branded OG images.
- XML sitemaps (index + per locale + per content type), `robots.txt`, clean URLs, breadcrumb
  navigation, internal linking between use cases, features and guides.
- Structured data (JSON-LD): Organization, WebSite (with SearchAction), SoftwareApplication,
  Product + Offer for plans, FAQPage, HowTo, BreadcrumbList, Article, VideoObject.
- Content strategy: pillar pages per use case + supporting guides targeting Saudi search intent in
  Arabic (e.g. "كيف أبدأ مشروع سطحات", "تطبيق سطحات خاص بشركتي", "منصة توصيل طلبات خاصة").
- Search Console and Bing Webmaster verification, IndexNow pings on publish, 404 and redirect
  monitoring.

## 5. AEO (answer engines, featured snippets, AI overviews, voice)

- Question-led headings with a direct 40 to 60 word answer immediately below, then detail.
- FAQ blocks on every use case and feature page (FAQPage schema), HowTo steps for launch guides.
- Definitions and comparison tables (e.g. "white-label platform vs building from scratch").
- Concise, factual, dated statements; avoid marketing fluff in answer blocks.

## 6. GEO (generative engines: being cited by ChatGPT, Gemini, Perplexity, Claude, Copilot)

GEO is an emerging practice with no guarantees; we apply what is known to help:
- A clear, consistent **entity definition** everywhere: "NX Serve is a Saudi white-label platform
  for launching on-demand service businesses (towing, logistics, home services) with Moyasar split
  payments, live tracking and an API." Same wording on site, LinkedIn, directories, press.
- `llms.txt` and `llms-full.txt` at the root summarising the product, pages and docs for LLMs.
- AI crawler policy configurable (GPTBot, ClaudeBot, PerplexityBot, Google-Extended, CCBot):
  allowed by default for marketing and docs content.
- Citable facts: numbers with sources, dated updates, author/expert bylines (E-E-A-T), case study
  data.
- Machine-readable pricing and feature pages (tables in HTML, JSON-LD Offers).
- Off-site presence plan (tracked in backlog): software directories, Arabic tech press, partner
  pages (Moyasar partners list), LinkedIn articles, developer community posts.

## 7. Analytics and consent

GA4 or privacy-friendly analytics, server-side events for conversions, PDPL-compliant consent
banner, UTM handling, A/B testing of hero and pricing.

## 8. Launch timing

Publish the marketing site early (Phase 1, parallel track): search visibility needs months to
mature. Start with home, towing and logistics use cases, pricing (waitlist/demo), and 5 guides.
