import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
    title: 'Kolektor JDIHN',
    description: 'Penjadwalan dan pemantauan pengumpulan regulasi dari JDIHN',
    icons: { icon: '/favicon.svg' },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
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
                        <nav className="flex gap-1">
                            <Link href="/" className="btn btn-ghost btn-sm">
                                Jadwal
                            </Link>
                            <Link href="/runs" className="btn btn-ghost btn-sm">
                                Riwayat
                            </Link>
                        </nav>
                    </div>
                </div>
                <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
            </body>
        </html>
    );
}
