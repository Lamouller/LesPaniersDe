import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { createServerClient } from '@supabase/ssr';

const PROTECTED_ADMIN = ['/admin'];
const PROTECTED_CLIENT = ['/account', '/shop'];
const PROTECTED_PRODUCER = ['/producer'];

export async function middleware(request: NextRequest) {
  // Supabase SSR session refresh
  const { response, supabase } = await updateSession(request);

  const { pathname } = request.nextUrl;

  // Locale handling via cookie
  const localeCookie = request.cookies.get('NEXT_LOCALE');
  const locale = localeCookie?.value ?? 'fr';
  if (!localeCookie) {
    response.cookies.set('NEXT_LOCALE', locale, { path: '/', maxAge: 31536000 });
  }

  // Auth check for protected zones
  const needsAuth =
    PROTECTED_ADMIN.some((p) => pathname.startsWith(p)) ||
    PROTECTED_CLIENT.some((p) => pathname.startsWith(p)) ||
    PROTECTED_PRODUCER.some((p) => pathname.startsWith(p));

  if (needsAuth) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Role-based redirect
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, entity_id')
      .eq('id', user.id)
      .single();

    const role = profile?.role as string | undefined;

    // Client without entity → onboarding
    if (
      role === 'client' &&
      !profile?.entity_id &&
      !pathname.startsWith('/onboarding')
    ) {
      return NextResponse.redirect(new URL('/onboarding/entity', request.url));
    }

    // Block wrong zones
    if (pathname.startsWith('/admin') && role !== 'admin') {
      return NextResponse.redirect(new URL('/', request.url));
    }
    if (pathname.startsWith('/producer') && role !== 'producer' && role !== 'admin') {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public|icons|manifest.json|sw.js|workbox-.*\\.js).*)',
  ],
};
