/**
 * Stable, machine readable error codes used across the API. The `code` in a
 * problem+json response is part of the public contract (ADR-0008, docs/11) and
 * must never change meaning. Add new codes; do not repurpose old ones.
 */
export const ERROR_CODES = {
  validation_error: { status: 422, title: 'Validation failed' },
  malformed_request: { status: 400, title: 'Malformed request' },
  unauthorized: { status: 401, title: 'Authentication required' },
  invalid_credentials: { status: 401, title: 'Invalid credentials' },
  mfa_required: { status: 401, title: 'Multi factor authentication required' },
  forbidden: { status: 403, title: 'Forbidden' },
  permission_denied: { status: 403, title: 'Permission denied' },
  entitlement_required: { status: 403, title: 'Entitlement required' },
  not_found: { status: 404, title: 'Resource not found' },
  tenant_not_resolved: { status: 404, title: 'Tenant could not be resolved' },
  method_not_allowed: { status: 405, title: 'Method not allowed' },
  conflict: { status: 409, title: 'Conflict' },
  idempotency_conflict: { status: 409, title: 'Idempotency key reused with a different request' },
  idempotency_key_required: { status: 400, title: 'Idempotency key required' },
  unsupported_media_type: { status: 415, title: 'Unsupported media type' },
  rate_limited: { status: 429, title: 'Too many requests' },
  payments_disabled: { status: 409, title: 'Payments are not enabled' },
  internal_error: { status: 500, title: 'Internal server error' },
  not_implemented: { status: 501, title: 'Not implemented' },
  service_unavailable: { status: 503, title: 'Service unavailable' },
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

export function httpStatusForCode(code: ErrorCode): number {
  return ERROR_CODES[code].status;
}

export function defaultTitleForCode(code: ErrorCode): string {
  return ERROR_CODES[code].title;
}
