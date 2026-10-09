# @nxserve/developers

The developer portal (Next.js 15, App Router). Phase 0 skeleton: it renders the API reference from
the OpenAPI 3.1 document generated from the Zod contracts, and links to the spec and Postman
collection. Guides (MDX), SDK and changelog arrive in Phase 6 (docs/11).

- `/` landing and conventions.
- `/reference` interactive reference (Scalar) over `public/openapi.json`.
- `public/openapi.json` is generated at build time from `@nxserve/contracts` (single source), so it
  never drifts from the API.

## Run

`pnpm --filter @nxserve/developers dev` (port 3005) or `build`. Both regenerate the spec first.
