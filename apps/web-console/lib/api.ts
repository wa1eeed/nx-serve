'use client';
import { useCallback, useEffect, useState } from 'react';
import type { Locale } from './i18n';

export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/v1';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Reads a JSON resource from the API. The console is a browser client: the access
 * token (set after staff sign in) is sent as a bearer header when present. Tenant
 * scoping is resolved server side from the host or the token, never from the client.
 */
export async function apiGet<T>(path: string, locale: Locale): Promise<T> {
  let token: string | null = null;
  try {
    token = window.localStorage.getItem('nx_access_token');
  } catch {
    token = null;
  }
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      accept: 'application/json',
      'accept-language': locale,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) {
    throw new ApiError(`GET ${path} failed`, res.status);
  }
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
