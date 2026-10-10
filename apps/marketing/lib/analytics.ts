'use client';

/**
 * Consent-gated analytics (docs/22 section 7). Nothing loads or tracks until the
 * visitor accepts: the privacy-preserving default. GA4 is optional (set
 * NEXT_PUBLIC_GA_ID); UTM parameters are captured for attribution and attached to
 * events. All access to window is guarded so this is safe during SSR.
 */

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

export type Consent = 'granted' | 'denied';
const CONSENT_KEY = 'nx_consent';
const UTM_KEY = 'nx_utm';
const UTM_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];

export function getConsent(): Consent | null {
  try {
    const v = window.localStorage.getItem(CONSENT_KEY);
    return v === 'granted' || v === 'denied' ? v : null;
  } catch {
    return null;
  }
}

export function hasConsent(): boolean {
  return getConsent() === 'granted';
}

export function setConsent(value: Consent): void {
  try {
    window.localStorage.setItem(CONSENT_KEY, value);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent('nx-consent-change', { detail: value }));
  if (value === 'granted') loadGa();
}

let gaLoaded = false;

/** Injects GA4 only after consent and only if an id is configured. */
export function loadGa(): void {
  if (gaLoaded || !GA_ID || typeof window === 'undefined') return;
  gaLoaded = true;
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(script);
  window.dataLayer = window.dataLayer ?? [];
  window.gtag = function gtag(...args: unknown[]): void {
    window.dataLayer!.push(args);
  };
  window.gtag('js', new Date());
  window.gtag('config', GA_ID, { anonymize_ip: true, send_page_view: false });
}

export function captureUtm(): void {
  try {
    const sp = new URLSearchParams(window.location.search);
    const got: Record<string, string> = {};
    let any = false;
    for (const key of UTM_PARAMS) {
      const value = sp.get(key);
      if (value) {
        got[key] = value;
        any = true;
      }
    }
    if (any) window.sessionStorage.setItem(UTM_KEY, JSON.stringify(got));
  } catch {
    /* ignore */
  }
}

export function getUtm(): Record<string, string> {
  try {
    const raw = window.sessionStorage.getItem(UTM_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export function pageview(path: string): void {
  if (typeof window === 'undefined' || !window.gtag) return;
  window.gtag('event', 'page_view', { page_path: path, ...getUtm() });
}

export function track(name: string, params?: Record<string, unknown>): void {
  if (typeof window === 'undefined' || !window.gtag) return;
  window.gtag('event', name, { ...getUtm(), ...params });
}
