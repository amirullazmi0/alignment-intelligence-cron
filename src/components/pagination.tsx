'use client';

interface Props {
    page: number;
    totalPages: number;
    total: number;
    limit: number;
    pageSizes: readonly number[];
    onPageChange: (page: number) => void;
    onLimitChange: (limit: number) => void;
    disabled?: boolean;
    /** Kata benda yang dihitung, misalnya "jadwal" atau "run". */
    noun?: string;
}

/** Kendali paginasi bersama untuk daftar yang dipaginasi di sisi server. */
export default function Pagination({
    page,
    totalPages,
    total,
    limit,
    pageSizes,
    onPageChange,
    onLimitChange,
    disabled = false,
    noun = 'baris',
}: Readonly<Props>) {
    const first = total === 0 ? 0 : (page - 1) * limit + 1;
    const last = Math.min(page * limit, total);

    return (
        <div className="flex flex-col gap-3 rounded-lg border border-base-content/10 bg-base-200 px-3 py-2 text-xs sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
                <select
                    value={limit}
                    onChange={(event) => onLimitChange(Number(event.target.value))}
                    className="select select-bordered select-xs w-20"
                    disabled={disabled}
                    aria-label={`Jumlah ${noun} per halaman`}
                >
                    {pageSizes.map((size) => (
                        <option key={size} value={size}>
                            {size}
                        </option>
                    ))}
                </select>
                {/* Tanpa nowrap, keterangan ini pecah jadi beberapa baris saat ruangnya sempit. */}
                <span className="whitespace-nowrap opacity-70">
                    {total === 0 ? `Tidak ada ${noun}` : `${first}–${last} dari ${total} ${noun}`}
                </span>
            </div>

            <div className="join self-end sm:self-auto">
                <button
                    type="button"
                    className="btn btn-outline join-item btn-xs"
                    onClick={() => onPageChange(page - 1)}
                    disabled={disabled || page <= 1}
                    aria-label="Halaman sebelumnya"
                >
                    ‹
                </button>
                <span className="btn btn-outline join-item pointer-events-none btn-xs whitespace-nowrap">
                    {page} / {totalPages}
                </span>
                <button
                    type="button"
                    className="btn btn-outline join-item btn-xs"
                    onClick={() => onPageChange(page + 1)}
                    disabled={disabled || page >= totalPages}
                    aria-label="Halaman berikutnya"
                >
                    ›
                </button>
            </div>
        </div>
    );
}
