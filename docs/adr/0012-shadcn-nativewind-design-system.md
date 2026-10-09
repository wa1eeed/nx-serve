# ADR-0012: shadcn/ui on web, NativeWind + React Native Reusables on mobile, one token source

- Status: Accepted
- Date: 2026-10-09

## Context
White-label platform: every tenant must look like its own brand, set at runtime. Arabic RTL first.
Data-dense consoles and simple consumer flows. Web and mobile should share a visual language.

## Decision
shadcn/ui (Radix + Tailwind) for all web apps, owned in `packages/ui-web`; TanStack Table/Virtual
for dense data; NativeWind + React Native Reusables for mobile; tokens in `packages/design-tokens`
overridden per tenant at runtime.

## Consequences
Full control of components and theming; we maintain component code ourselves; consistent naming
across web and mobile.

## Alternatives considered
MUI, Ant Design, Chakra UI, DaisyUI (see docs/21 section 2).
