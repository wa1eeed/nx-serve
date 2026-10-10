'use client';
import { useEffect, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { captureUtm, hasConsent, loadGa, pageview } from '../lib/analytics';

/** Loads GA only after consent and tracks page views on client navigation. */
export function Analytics(): ReactNode {
  const pathname = usePathname();

  useEffect(() => {
    captureUtm();
    if (hasConsent()) loadGa();
    const onConsent = (e: Event): void => {
      if ((e as CustomEvent).detail === 'granted') {
        loadGa();
        pageview(window.location.pathname + window.location.search);
      }
    };
    window.addEventListener('nx-consent-change', onConsent);
    return () => window.removeEventListener('nx-consent-change', onConsent);
  }, []);

  useEffect(() => {
    if (hasConsent()) pageview(pathname);
  }, [pathname]);

  return null;
}
