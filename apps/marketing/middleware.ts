import { NextResponse, type NextRequest } from 'next/server';
import { DEFAULT_LOCALE } from './lib/i18n';

/** Sends the bare root to the default locale; all content lives under /ar or /en. */
export function middleware(request: NextRequest): NextResponse {
  return NextResponse.redirect(new URL(`/${DEFAULT_LOCALE}`, request.url));
}

export const config = {
  matcher: '/',
};
