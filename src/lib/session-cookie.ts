/**
 * Nama cookie sesi, sengaja dipisah dari `session.ts`.
 *
 * `proxy.ts` ikut membacanya, dan proxy berjalan di runtime yang tidak menyediakan
 * `next/headers`. Modul ini tidak mengimpor apa pun sehingga aman dipakai keduanya.
 */
export const SESSION_COOKIE_NAME = 'collector_access_token';
export const REFRESH_COOKIE_NAME = 'collector_refresh_token';
