# ADR-0010: Branded tenant apps are published under the tenant's own store accounts

- Status: Accepted
- Date: 2026-10-09

## Decision
Shared NX apps for lower plans; branded apps built by our pipeline but published with the
tenant's Apple and Google accounts (credentials stored in secrets manager).

## Consequences
Complies with Apple rules on template-generated apps; tenant owns its listing; onboarding needs
guidance for developer account creation (D-U-N-S, API keys).
