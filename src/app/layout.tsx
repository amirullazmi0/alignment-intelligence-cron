import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import './globals.css';

import { logoutAction } from '@/app/login/actions';
import NavLinks from '@/components/nav-links';
import { currentUser } from '@/lib/session';
import { SESSION_COOKIE_NAME } from '@/lib/session-cookie';

export const metadata: Metadata = {
    title: 'Kolektor Regulasi',
    description: 'Penjadwalan dan pemantauan pengumpulan regulasi untuk Alignment Intelligence',
    icons: { icon: '/favicon.svg' },
};

// Sesi dibaca tiap permintaan, jadi kerangka halaman tidak boleh dirender statis.
export const dynamic = 'force-dynamic';

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    const user = await currentUser();
    // Tombol keluar muncul selama browser memegang sesi, juga ketika profil gagal dibaca
    // (token kedaluwarsa, kolektor sedang restart). Sebelumnya tombol itu ikut hilang
    // bersama profil, sehingga pengguna terjebak tanpa jalan keluar.
    const hasSession = Boolean((await cookies()).get(SESSION_COOKIE_NAME)?.value);
    return (
        // Tema dikunci di root, bukan mengikuti preferensi sistem, supaya panel log yang
        // gelap tidak pernah berdampingan dengan antarmuka terang.
        <html lang="id" data-theme="business">
            <body className="min-h-screen bg-base-300">
                <header className="border-b border-base-content/10 bg-base-200">
                    <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                        <Link href="/" className="flex items-center gap-2 font-semibold">
                            <span className="text-primary">▍</span>
                            <span>Kolektor Regulasi</span>
                            <span className="hidden text-xs font-normal opacity-60 md:inline">
                                Alignment Intelligence
                            </span>
                        </Link>
                        {hasSession && (
                            <div className="ml-auto flex items-center gap-2">
                                {user ? (
                                    <div className="hidden text-right leading-tight sm:block">
                                        <div className="text-xs">{user.email}</div>
                                        {user.role && (
                                            <div className="text-[10px] uppercase tracking-wide opacity-60">
                                                {user.role}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <span className="badge badge-warning badge-sm">
                                        sesi bermasalah, silakan keluar lalu masuk lagi
                                    </span>
                                )}
                                <form action={logoutAction}>
                                    <button type="submit" className="btn btn-outline btn-sm">
                                        <svg
                                            aria-hidden="true"
                                            viewBox="0 0 24 24"
                                            className="h-4 w-4"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                        >
                                            <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H3" />
                                        </svg>
                                        Keluar
                                    </button>
                                </form>
                            </div>
                        )}
                    </div>
                    {hasSession && (
                        <div className="mx-auto w-full max-w-6xl px-4 pb-2">
                            <NavLinks />
                        </div>
                    )}
                </header>
                <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
            </body>
        </html>
    );
}
