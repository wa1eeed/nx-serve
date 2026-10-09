# NX Serve

Configurable, multi-tenant, white-label platform for on-demand and scheduled field services in
Saudi Arabia, built on Moyasar payments. Towing is the first vertical; any service can be launched
by configuration.

> منصة خدمات ميدانية متعددة المستأجرين بنظام الوايت ليبل، مبنية على مدفوعات ميسر (الحجز ثم الخصم
> مع تقسيم المدفوعات). السطحات أول خدمة، وأي خدمة أخرى تُطلق بالإعدادات دون برمجة. تُباع المنصة
> كتراخيص لرواد الأعمال لإطلاق منصاتهم بعلاماتهم ودوميناتهم وتطبيقاتهم.

## Start here

1. Unzip `NX Serve.zip`; it creates the folder `nx-serve`. Open that folder in your terminal.
2. Run `git init` (keep the repository **private**).
3. Start Claude Code in this folder and paste the prompt in `KICKOFF_PROMPT.md`.

Claude Code reads `CLAUDE.md` automatically. Everything we decided lives in `docs/`.

## What is in this kit

| Path | Content |
|---|---|
| `CLAUDE.md` | Master instructions for Claude Code: rules, stack, structure, workflow |
| `KICKOFF_PROMPT.md` | The first message to give Claude Code |
| `docs/00-decisions-log.md` | Every decision taken during design, in one place |
| `docs/01..25` | Detailed specifications per area (product, domain, architecture, payments, pricing, white-label, API, infra, roadmap, app launch...) |
| `docs/adr/` | Architecture Decision Records |
| `docs/PROGRESS.md` | Progress tracker Claude Code keeps updated |
| `database/reference-schema.sql` | Validated reference schema (PostgreSQL 16 + PostGIS, 94 tables) |
| `reference/private/moyasar/` | Moyasar agreement draft and Platform API deck (git-ignored) |
| `.claude/commands/` | Custom slash commands for recurring workflows |

## Environments

- local: docker-compose
- staging: own VPS via Coolify, production-identical
- production: Alibaba Cloud through SCCC (Saudi region), same images promoted from staging
