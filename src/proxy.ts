import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { SESSION_COOKIE_NAME } from '@/lib/session-cookie';

/**
 * Pemeriksaan sesi tingkat pertama.
 *
 * Di sini hanya keberadaan cookie yang diperiksa, bukan keabsahan tokennya. Proxy
 * berjalan pada setiap permintaan dan tidak boleh menambah satu panggilan jaringan ke
 * Nest tiap kali. Keabsahan diperiksa di tempat yang benar-benar menentukan: route
 * `/api/collector/*` yang meneruskan perintah ke kolektor, dan server component yang
 * memuat halaman. Cookie palsu paling jauh hanya menghasilkan halaman kosong lalu
 * dilempar balik ke login.
 */
export function proxy(request: NextRequest) {
    const hasSession = request.cookies.has(SESSION_COOKIE_NAME);
    const { pathname, search } = request.nextUrl;
    const isLogin = pathname === '/login';

    if (!hasSession && !isLogin) {
        const target = new URL('/login', request.url);
        // Setelah masuk, pengguna dikembalikan ke halaman yang tadi dituju.
        if (pathname !== '/') target.searchParams.set('next', `${pathname}${search}`);
        return NextResponse.redirect(target);
    }

    if (hasSession && isLogin) {
        return NextResponse.redirect(new URL('/', request.url));
    }

    return NextResponse.next();
}

export const config = {
    // Aset statis dan berkas Next tidak ikut diperiksa; hanya halaman dan API aplikasi.
    matcher: ['/((?!_next/static|_next/image|favicon.ico|favicon.svg).*)'],
};
