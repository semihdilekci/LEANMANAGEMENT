import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { isAuthProtectedAppPath } from '@/lib/auth-protected-paths';
import { SESSION_HINT_COOKIE } from '@/lib/auth-session-hint';

const AUTH_PATHS = ['/login', '/forgot-password', '/reset-password'];

function isAuthPath(pathname: string): boolean {
  return AUTH_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const hint = request.cookies.get(SESSION_HINT_COOKIE)?.value === '1';

  if (pathname.startsWith('/_next') || pathname.startsWith('/api') || pathname.includes('.')) {
    return NextResponse.next();
  }

  if (hint && isAuthPath(pathname)) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  if (!hint && isAuthProtectedAppPath(pathname)) {
    const login = new URL('/login', request.url);
    login.searchParams.set('redirect', pathname);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
