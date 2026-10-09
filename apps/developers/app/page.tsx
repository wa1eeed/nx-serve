import type { ReactNode } from 'react';

export default function Home(): ReactNode {
  return (
    <main className="container">
      <h1>NX Serve Developers</h1>
      <p className="muted">
        One API for on-demand field services: estimates, orders, tracking, payments and webhooks.
        Our own apps use the same API you do.
      </p>

      <div className="card">
        <h2>Start here</h2>
        <ul>
          <li>
            <a href="/reference">API reference</a> rendered from the OpenAPI 3.1 spec.
          </li>
          <li>
            <a href="/openapi.json">openapi.json</a> and the generated Postman collection.
          </li>
        </ul>
      </div>

      <div className="card">
        <h2>Conventions</h2>
        <ul>
          <li>Base URL is versioned: <code>https://api.nxserve.dev/v1</code>.</li>
          <li>JSON is <code>snake_case</code>; amounts are integer minor units plus a currency.</li>
          <li>
            Errors are RFC 9457 <code>application/problem+json</code> with a stable <code>code</code>.
          </li>
          <li>
            POSTs that create or charge require an <code>Idempotency-Key</code> header.
          </li>
          <li>Set <code>Accept-Language: ar</code> or <code>en</code> for localized messages.</li>
        </ul>
      </div>

      <div className="card">
        <h2>Quickstart</h2>
        <ol>
          <li>Resolve your tenant: call <code>GET /v1/app/bootstrap</code> on your tenant host.</li>
          <li>Authenticate: <code>POST /v1/auth/otp/request</code> then <code>/auth/otp/verify</code>.</li>
          <li>Use the returned bearer token on subsequent calls.</li>
          <li>Explore every endpoint in the <a href="/reference">reference</a>.</li>
        </ol>
        <p className="muted">
          Payments run in sandbox only until the gateway is enabled. This portal is a Phase 0
          skeleton; guides, SDK and changelog follow in Phase 6.
        </p>
      </div>
    </main>
  );
}
