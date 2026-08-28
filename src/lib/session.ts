import { cookies } from 'next/headers';

import { collectorApiUrl, collectorInternalToken } from '@/lib/env';
import { REFRESH_COOKIE_NAME, SESSION_COOKIE_NAME } from '@/lib/session-cookie';

/**
 * Sesi dashboard kolektor.
 *
 * Aplikasi ini hanya berbicara dengan satu backend: kolektor. Verifikasi kredensial
 * memang berujung ke Alignment Intelligence, tetapi itu urusan kolektor — alamat Nest,
 * kontraknya, dan aturan "hanya ADMIN" seluruhnya berada di sana. Frontend jadi tidak
 * perlu tahu di mana Nest berada, dan aturan role tidak punya jalur yang bisa dilewati
 * dari sisi ini.
 *
 * Token disimpan sebagai cookie httpOnly sehingga tidak pernah terbaca skrip di browser.
 */

/** Cookie tidak menentukan masa berlaku sesi; token itu sendiri yang menentukan. */
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export interface SessionUser {
    id: string;
    email: string;
    role: string;
}

interface LoginResponse {
    user: SessionUser;
    accessToken: string;
    refreshToken: string;
}

function cookieOptions() {
    return {
        httpOnly: true,
        sameSite: 'lax' as const,
        // Di belakang proxy TLS, cookie hanya dikirim lewat HTTPS. Saat pengembangan
        // lokal syarat itu dilonggarkan supaya login tetap bisa dicoba di http.
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: COOKIE_MAX_AGE_SECONDS,
    };
}

function isLoginResponse(value: unknown): value is LoginResponse {
    if (typeof value !== 'object' || value === null) return false;
    const record = value as Record<string, unknown>;
    const user = record.user as Record<string, unknown> | undefined;
    return (
        typeof record.accessToken === 'string' &&
        typeof record.refreshToken === 'string' &&
        typeof user?.id === 'string' &&
        typeof user.email === 'string'
    );
}

function readUser(payload: unknown): SessionUser | null {
    if (typeof payload !== 'object' || payload === null) return null;
    const record = payload as Record<string, unknown>;
    const nested = record.user;
    const source = (typeof nested === 'object' && nested !== null ? nested : record) as Record<
        string,
        unknown
    >;
    if (typeof source.id !== 'string' || typeof source.email !== 'string') return null;
    return {
        id: source.id,
        email: source.email,
        role: typeof source.role === 'string' ? source.role : '',
    };
}

/**
 * Permintaan ke kolektor dari sisi server. `COLLECTOR_INTERNAL_TOKEN` disisipkan di
 * sini, sehingga endpoint auth kolektor tetap tertutup bagi siapa pun selain server ini.
 */
async function collector(path: string, init?: RequestInit): Promise<Response> {
    const headers: Record<string, string> = {
        'content-type': 'application/json',
        ...((init?.headers as Record<string, string> | undefined) ?? {}),
    };
    const internalToken = collectorInternalToken();
    if (internalToken) headers['x-internal-token'] = internalToken;
    return await fetch(`${collectorApiUrl()}${path}`, { ...init, headers, cache: 'no-store' });
}

/** Pesan galat FastAPI ada di `detail`; itu yang layak dibaca pengguna. */
async function detailOf(response: Response, fallback: string): Promise<string> {
    const body: unknown = await response.json().catch(() => null);
    if (typeof body === 'object' && body !== null) {
        const detail = (body as Record<string, unknown>).detail;
        if (typeof detail === 'string' && detail) return detail;
    }
    return fallback;
}

/**
 * Tukar email dan kata sandi dengan sesi. Mengembalikan pesan galat, bukan melempar,
 * karena pemanggilnya adalah form yang perlu menampilkannya apa adanya.
 */
export async function signIn(email: string, password: string): Promise<string | null> {
    let response: Response;
    try {
        response = await collector('/v1/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        });
    } catch {
        return `Backend kolektor tidak dapat dihubungi (${collectorApiUrl()}).`;
    }

    if (!response.ok) return await detailOf(response, `Login gagal (${response.status}).`);

    const payload: unknown = await response.json();
    if (!isLoginResponse(payload)) return 'Backend kolektor membalas bentuk yang tidak dikenali.';

    const store = await cookies();
    store.set(SESSION_COOKIE_NAME, payload.accessToken, cookieOptions());
    store.set(REFRESH_COOKIE_NAME, payload.refreshToken, cookieOptions());
    return null;
}

export async function signOut(): Promise<void> {
    const store = await cookies();
    const accessToken = store.get(SESSION_COOKIE_NAME)?.value;
    if (accessToken) {
        // Kegagalan di backend tidak boleh menahan logout lokal; cookie tetap dibuang.
        try {
            await collector('/v1/auth/logout', {
                method: 'POST',
                headers: { authorization: `Bearer ${accessToken}` },
            });
        } catch {
            // sengaja diabaikan
        }
    }
    store.delete(SESSION_COOKIE_NAME);
    store.delete(REFRESH_COOKIE_NAME);
}

/**
 * Pengguna sesi saat ini, atau null bila belum masuk.
 *
 * Token akses berumur pendek, jadi 401 dicoba sekali lagi dengan refresh token sebelum
 * dianggap kedaluwarsa. Tanpa itu pengguna terlempar ke halaman login setiap kali token
 * akses habis, padahal sesinya masih sah. Role diperiksa ulang oleh kolektor pada setiap
 * panggilan, sehingga akun yang haknya dicabut langsung kehilangan akses.
 */
export async function currentUser(): Promise<SessionUser | null> {
    const store = await cookies();
    const accessToken = store.get(SESSION_COOKIE_NAME)?.value;
    if (!accessToken) return null;

    const me = await collector('/v1/auth/me', {
        headers: { authorization: `Bearer ${accessToken}` },
    }).catch(() => null);

    if (me?.ok) return readUser(await me.json());
    // 403 berarti sesinya sah tetapi bukan admin lagi; refresh tidak akan menolong.
    if (me && me.status !== 401) return null;

    const refreshToken = store.get(REFRESH_COOKIE_NAME)?.value;
    if (!refreshToken) return null;

    const refreshed = await collector('/v1/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
    }).catch(() => null);
    if (!refreshed?.ok) return null;

    const payload: unknown = await refreshed.json();
    if (!isLoginResponse(payload)) return null;
    store.set(SESSION_COOKIE_NAME, payload.accessToken, cookieOptions());
    store.set(REFRESH_COOKIE_NAME, payload.refreshToken, cookieOptions());
    return payload.user;
}
