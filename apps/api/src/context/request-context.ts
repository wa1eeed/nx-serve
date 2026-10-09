import { AsyncLocalStorage } from 'node:async_hooks';

export type ActorType = 'customer' | 'agent' | 'staff' | 'api_client' | 'system';

export interface Actor {
  type: ActorType;
  id?: string;
}

/** Everything a request handler needs to know about the caller and tenant. */
export interface RequestContext {
  requestId: string;
  locale: 'ar' | 'en';
  actor: Actor;
  tenantId?: string;
  entitlements?: string[];
  permissions?: string[];
}

const storage = new AsyncLocalStorage<RequestContext>();

export function runWithContext<T>(context: RequestContext, fn: () => T): T {
  return storage.run(context, fn);
}

/** The current request context, or undefined outside a request (jobs, startup). */
export function getContext(): RequestContext | undefined {
  return storage.getStore();
}

/** The current context, throwing if there is none. */
export function requireContext(): RequestContext {
  const ctx = storage.getStore();
  if (!ctx) {
    throw new Error('No request context is active');
  }
  return ctx;
}

export function requireTenantId(): string {
  const { tenantId } = requireContext();
  if (!tenantId) {
    throw new Error('No tenant is resolved for this request');
  }
  return tenantId;
}
