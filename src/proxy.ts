import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { collectorApiUrl, collectorInternalToken } from '@/lib/env';
import { REFRESH_COOKIE_NAME, SESSION_COOKIE_NAME } from '@/lib/session-cookie';

/** Token yang tersisa kurang dari ini dianggap sudah habis, supaya tidak mati di tengah render. */
const REFRESH_LEEWAY_SECONDS = 60;
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

/**
 * Detik kedaluwarsa JWT, dibaca tanpa verifikasi tanda tangan. Cukup untuk memutuskan
 * kapan perlu refresh; keabsahannya tetap diperiksa kolektor pada setiap panggilan.
 */
function expiresAt(token: string): number | null {
    const part = token.split('.')[1];
    if (!part) return null;
    try {
        const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
        const exp = (JSON.parse(json) as { exp?: unknown }).exp;
        return typeof exp === 'number' ? exp : null;
    } catch {
        return null;
    }
}

function needsRefresh(accessToken: string | undefined): boolean {
    if (!accessToken) return true;
    const exp = expiresAt(accessToken);
    return exp !== null && exp - REFRESH_LEEWAY_SECONDS <= Date.now() / 1000;
}

async function refreshTokens(
    refreshToken: string,
): Promise<{ accessToken: string; refreshToken: string } | null> {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    const internalToken = collectorInternalToken();
    if (internalToken) headers['x-internal-token'] = internalToken;
    try {
        const response = await fetch(`${collectorApiUrl()}/v1/auth/refresh`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ refreshToken }),
            cache: 'no-store',
        });
        if (!response.ok) return null;
        const payload = (await response.json()) as Record<string, unknown>;
        if (typeof payload.accessToken !== 'string' || typeof payload.refreshToken !== 'string') {
            return null;
        }
        return { accessToken: payload.accessToken, refreshToken: payload.refreshToken };
    } catch {
        return null;
    }
}

/**
 * Pemeriksaan sesi tingkat pertama, sekaligus tempat token akses diperbarui.
 *
 * Keabsahan token tidak diperiksa di sini; itu tugas route `/api/collector/*` dan server
 * component. Yang dilakukan proxy hanya membaca `exp` token akses dan, bila hampir habis,
 * menukar refresh token dengan pasangan baru. Refresh harus terjadi di sini: server
 * component tidak boleh menulis cookie, sedangkan Nest merotasi refresh token pada setiap
 * refresh. Refresh dari server component membuat token lama di browser tidak berlaku lagi
 * tanpa penggantinya tersimpan, sehingga sesi putus sekitar 15 menit setelah login.
 */
export async function proxy(request: NextRequest) {
    const { pathname, search } = request.nextUrl;
    const isLogin = pathname === '/login';

    const accessToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    const refreshToken = request.cookies.get(REFRESH_COOKIE_NAME)?.value;
    const refreshed =
        refreshToken && needsRefresh(accessToken) ? await refreshTokens(refreshToken) : null;
    const hasSession = Boolean(refreshed ?? accessToken);

    if (!hasSession && !isLogin) {
        const target = new URL('/login', request.url);
        // Setelah masuk, pengguna dikembalikan ke halaman yang tadi dituju.
        if (pathname !== '/') target.searchParams.set('next', `${pathname}${search}`);
        return NextResponse.redirect(target);
    }

    if (hasSession && isLogin) {
        return NextResponse.redirect(new URL('/', request.url));
    }

    if (!refreshed) return NextResponse.next();

    // Token baru dipasang di permintaan yang diteruskan, supaya server component pada
    // permintaan ini juga sudah melihatnya, dan di respons, supaya browser menyimpannya.
    request.cookies.set(SESSION_COOKIE_NAME, refreshed.accessToken);
    request.cookies.set(REFRESH_COOKIE_NAME, refreshed.refreshToken);
    const response = NextResponse.next({ request: { headers: request.headers } });
    const options = {
        httpOnly: true,
        sameSite: 'lax' as const,
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: COOKIE_MAX_AGE_SECONDS,
    };
    response.cookies.set(SESSION_COOKIE_NAME, refreshed.accessToken, options);
    response.cookies.set(REFRESH_COOKIE_NAME, refreshed.refreshToken, options);
    return response;
}

export const config = {
    // Aset statis dan berkas Next tidak ikut diperiksa; hanya halaman dan API aplikasi.
    matcher: ['/((?!_next/static|_next/image|favicon.ico|favicon.svg).*)'],
};
