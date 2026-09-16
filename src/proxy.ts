import { type NextRequest, NextResponse } from 'next/server';
import { buildLoginUrl, ROUTES } from '@/constants/routes';
import { SESSION_HINT_COOKIE } from '@/constants/session';

/**
 * Optimistic route protection. The session hint cookie only says a session probably exists; the
 * client confirms it with the API before rendering protected data, and the API authorises every
 * request. This avoids flashing protected screens to signed-out visitors.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSessionHint = request.cookies.get(SESSION_HINT_COOKIE)?.value === '1';

  const isProtected =
    pathname === ROUTES.dashboard || pathname.startsWith(`${ROUTES.dashboard}/`) || pathname === ROUTES.changePassword;

  if (isProtected && !hasSessionHint) {
    return NextResponse.redirect(new URL(buildLoginUrl({ next: `${pathname}${search}` }), request.url));
  }

  if (pathname === ROUTES.login && hasSessionHint) {
    return NextResponse.redirect(new URL(ROUTES.dashboard, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/change-password', '/login'],
};
