'use client';
import { useCallback, useEffect, useState } from 'react';
import type { Locale } from './i18n';

export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/v1';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function authHeader(): Record<string, string> {
  try {
    const token = window.localStorage.getItem('nx_access_token');
    return token ? { authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

/**
 * Reads a JSON resource from the API. The console is a browser client: the access
 * token (set after staff sign in) is sent as a bearer header when present. Tenant
 * scoping is resolved server side from the host or the token, never from the client.
 */
export async function apiGet<T>(path: string, locale: Locale): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { accept: 'application/json', 'accept-language': locale, ...authHeader() },
  });
  if (!res.ok) {
    throw new ApiError(`GET ${path} failed`, res.status);
  }
  return (await res.json()) as T;
}

type WriteMethod = 'POST' | 'PATCH' | 'PUT' | 'DELETE';

/**
 * Writes to the API (create, update, install). POSTs carry an Idempotency-Key so a
 * retried submit never double-creates (docs/11). On failure the problem+json code and
 * detail are surfaced so the UI can show the real reason, not a generic message.
 */
export async function apiSend<T>(
  method: WriteMethod,
  path: string,
  body: unknown,
  locale: Locale,
): Promise<T> {
  const headers: Record<string, string> = {
    accept: 'application/json',
    'accept-language': locale,
    ...authHeader(),
  };
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (method === 'POST') {
    try {
      headers['idempotency-key'] = window.crypto.randomUUID();
    } catch {
      /* older browsers: the server still de-dupes on its own keys */
    }
  }
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    let code: string | undefined;
    let detail: string | undefined;
    try {
      const problem = (await res.json()) as { code?: string; detail?: string };
      code = problem.code;
      detail = problem.detail;
    } catch {
      /* non-json error body */
    }
    throw new ApiError(detail ?? `${method} ${path} failed`, res.status, code);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export type AsyncState<T> =
  | { status: 'loading' }
  | { status: 'error'; error: ApiError | Error }
  | { status: 'ready'; data: T };

/** Fetches a resource on mount and whenever the locale changes, with a retry handle. */
export function useApi<T>(path: string, locale: Locale): AsyncState<T> & { reload: () => void } {
  const [state, setState] = useState<AsyncState<T>>({ status: 'loading' });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    apiGet<T>(path, locale)
      .then((data) => {
        if (!cancelled) setState({ status: 'ready', data });
      })
      .catch((error: unknown) => {
        if (!cancelled) setState({ status: 'error', error: error as Error });
      });
    return () => {
      cancelled = true;
    };
  }, [path, locale, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { ...state, reload };
}
