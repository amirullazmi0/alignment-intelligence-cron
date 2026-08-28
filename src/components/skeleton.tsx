/**
 * Placeholder pemuatan yang meniru bentuk kontennya.
 *
 * Skeleton dipakai alih-alih spinner supaya tinggi halaman tidak berubah saat data
 * datang: isi tidak melompat, dan pengguna langsung melihat struktur apa yang sedang
 * disiapkan. Jumlah baris sengaja bisa diatur agar cocok dengan ukuran halaman yang
 * sedang dipakai.
 */

/** Sebaris balok abu-abu. `width` memakai kelas Tailwind, misalnya `w-32`. */
export function SkeletonBar({ width = 'w-full', className = '' }: Readonly<{
    width?: string;
    className?: string;
}>) {
    return <span className={`skeleton block h-3 ${width} ${className}`} />;
}

/**
 * Skeleton untuk daftar kartu, misalnya daftar jadwal.
 *
 * Tinggi tiap kartu disamakan dengan kartu aslinya supaya pergantian ke konten nyata
 * tidak menggeser posisi gulir.
 */
export function SkeletonCards({ rows = 5 }: Readonly<{ rows?: number }>) {
    return (
        <div className="space-y-2" aria-hidden="true">
            {Array.from({ length: rows }, (_, index) => (
                <div
                    key={index}
                    className="card border border-base-content/10 bg-base-200"
                >
                    <div className="card-body flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0 flex-1 space-y-2">
                            <SkeletonBar width="w-56" className="h-4" />
                            <SkeletonBar width="w-72" />
                            <SkeletonBar width="w-40" />
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <span className="skeleton h-6 w-32" />
                            <span className="skeleton h-6 w-16" />
                            <span className="skeleton h-6 w-16" />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

/** Skeleton untuk baris tabel; jumlah kolomnya mengikuti tabel yang dimuat. */
export function SkeletonTableRows({
    rows = 10,
    columns,
}: Readonly<{ rows?: number; columns: readonly string[] }>) {
    return (
        <>
            {Array.from({ length: rows }, (_, rowIndex) => (
                <tr key={rowIndex} aria-hidden="true">
                    {columns.map((width, columnIndex) => (
                        <td key={columnIndex} className="p-3">
                            <SkeletonBar width={width} />
                        </td>
                    ))}
                </tr>
            ))}
        </>
    );
}
