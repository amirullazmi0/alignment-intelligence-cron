'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
    { href: '/', label: 'Jadwal', hint: 'Atur kapan kolektor berjalan' },
    { href: '/runs', label: 'Riwayat', hint: 'Setiap kali kolektor berjalan' },
    { href: '/documents', label: 'Dokumen', hint: 'Apa saja yang sudah dikumpulkan' },
    { href: '/catalog', label: 'Katalog peraturan.go.id', hint: 'Cermin seluruh peraturan resmi' },
] as const;

function isActive(pathname: string, href: string): boolean {
    return href === '/' ? pathname === '/' : pathname.startsWith(href);
}

/** Tab navigasi; tab halaman yang sedang dibuka disorot. */
export default function NavLinks() {
    const pathname = usePathname();
    return (
        <nav className="flex flex-wrap gap-1">
            {LINKS.map((link) => (
                <Link
                    key={link.href}
                    href={link.href}
                    title={link.hint}
                    className={`btn btn-sm ${
                        isActive(pathname, link.href) ? 'btn-primary' : 'btn-ghost'
                    }`}
                >
                    {link.label}
                </Link>
            ))}
        </nav>
    );
}
