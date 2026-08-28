import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

import { logoutAction } from '@/app/login/actions';
import { currentUser } from '@/lib/session';

export const metadata: Metadata = {
    title: 'Kolektor JDIHN',
    description: 'Penjadwalan dan pemantauan pengumpulan regulasi dari JDIHN',
    icons: { icon: '/favicon.svg' },
};

// Sesi dibaca tiap permintaan, jadi kerangka halaman tidak boleh dirender statis.
export const dynamic = 'force-dynamic';

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    const user = await currentUser();
    return (
        // Tema dikunci di root, bukan mengikuti preferensi sistem, supaya panel log yang
        // gelap tidak pernah berdampingan dengan antarmuka terang.
        <html lang="id" data-theme="business">
            <body className="min-h-screen bg-base-300">
                <div className="navbar border-b border-base-content/10 bg-base-200">
                    <div className="mx-auto flex w-full max-w-6xl items-center gap-2 px-4">
                        <Link href="/" className="btn btn-ghost text-base font-semibold">
                            <span className="text-primary">▍</span> Kolektor JDIHN
                        </Link>
                        {user && (
                            <nav className="flex gap-1">
                                <Link href="/" className="btn btn-ghost btn-sm">
                                    Jadwal
                                </Link>
                                <Link href="/runs" className="btn btn-ghost btn-sm">
                                    Riwayat
                                </Link>
                            </nav>
                        )}
                        {user && (
                            <div className="ml-auto flex items-center gap-2">
                                <span className="hidden text-xs opacity-70 sm:inline">
                                    {user.email}
                                </span>
                                <form action={logoutAction}>
                                    <button type="submit" className="btn btn-ghost btn-sm">
                                        Keluar
                                    </button>
                                </form>
                            </div>
                        )}
                    </div>
                </div>
                <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
            </body>
        </html>
    );
}
