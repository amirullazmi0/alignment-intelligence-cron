'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import Pagination from '@/components/pagination';
import { SkeletonCards } from '@/components/skeleton';
import { api } from '@/lib/api';
import {
    CATALOGUE_LABELS,
    type CatalogJob,
    type CatalogStats,
    type Regulation,
} from '@/lib/types';

const PAGE_SIZES = [20, 50, 100] as const;
const SEARCH_DEBOUNCE_MS = 300;
const POLL_MS = 15_000;

const JOBS: { job: CatalogJob; title: string; when: string; what: string }[] = [
    {
        job: 'sync_new',
        title: 'Cek peraturan baru',
        when: 'tiap jam, menit ke-5',
        what: 'Membaca halaman 1–2 tiap jenis, tempat peraturan baru muncul.',
    },
    {
        job: 'refresh_details',
        title: 'Cek ulang status & relasi',
        when: 'tiap jam, menit ke-15',
        what: 'Membuka halaman detail: status berlaku/dicabut, relasi, PDF. Perubahan dikirim ke Alignment.',
    },
    {
        job: 'ingest_text',
        title: 'Kirim teks ke Alignment',
        when: 'tiap jam, menit ke-40',
        what: 'Peraturan yang belum punya teks didaftarkan lewat tautan PDF resminya, UU lebih dulu.',
    },
    {
        job: 'sweep',
        title: 'Sapuan seluruh katalog',
        when: 'tiap malam 01.30',
        what: 'Membaca semua halaman daftar supaya tidak ada peraturan yang terlewat.',
    },
];

const TEXT_STATUS: Record<Regulation['textStatus'], { label: string; badge: string }> = {
    PENDING: { label: 'Menunggu', badge: 'badge-ghost' },
    RETRY: { label: 'Dicoba lagi', badge: 'badge-warning' },
    REGISTERED: { label: 'Masuk Alignment', badge: 'badge-success' },
    DUPLICATE: { label: 'Sudah ada', badge: 'badge-info' },
    NO_PDF: { label: 'Tanpa PDF', badge: 'badge-ghost' },
    FAILED: { label: 'Gagal', badge: 'badge-error' },
};

const COUNT_LABELS: Record<string, string> = {
    pages: 'halaman',
    new: 'baru',
    completed: 'jenis selesai',
    checked: 'dicek',
    changed: 'berubah',
    pushed: 'dikirim',
    missing: 'halaman hilang',
    registered: 'terdaftar',
    duplicate: 'sudah ada',
    noPdf: 'tanpa PDF',
    retry: 'dicoba lagi',
    failed: 'gagal',
    errors: 'galat',
};

function formatDateTime(value: string | null | undefined): string {
    if (!value) return '—';
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleString('id-ID');
}

function percent(part: number, whole: number): number {
    return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

export default function CatalogPage() {
    const [stats, setStats] = useState<CatalogStats | null>(null);
    const [items, setItems] = useState<Regulation[]>([]);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState<number>(PAGE_SIZES[0]);
    const [catalogue, setCatalogue] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [search, setSearch] = useState('');
    const [appliedSearch, setAppliedSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const latestRequest = useRef(0);

    const loadStats = useCallback(async () => {
        try {
            setStats(await api.catalogStats());
        } catch (statsError) {
            setError(statsError instanceof Error ? statsError.message : 'Gagal memuat katalog');
        }
    }, []);

    const loadList = useCallback(async () => {
        const requestId = ++latestRequest.current;
        setLoading(true);
        try {
            const result = await api.regulations({
                page,
                limit: pageSize,
                catalogue,
                status: statusFilter,
                q: appliedSearch.trim(),
            });
            if (requestId !== latestRequest.current) return;
            setItems(result.items);
            setTotal(result.total);
            setTotalPages(result.totalPages);
            setError('');
        } catch (listError) {
            if (requestId !== latestRequest.current) return;
            setError(listError instanceof Error ? listError.message : 'Gagal memuat peraturan');
        } finally {
            if (requestId === latestRequest.current) setLoading(false);
        }
    }, [page, pageSize, catalogue, statusFilter, appliedSearch]);

    useEffect(() => {
        void (async () => {
            await loadList();
        })();
    }, [loadList]);

    // Statistik dan status job diperbarui berkala, supaya job yang sedang jalan terlihat.
    useEffect(() => {
        void (async () => {
            await loadStats();
        })();
        const timer = setInterval(() => void loadStats(), POLL_MS);
        return () => clearInterval(timer);
    }, [loadStats]);

    useEffect(() => {
        const timer = setTimeout(() => {
            setAppliedSearch(search);
            setPage(1);
        }, SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [search]);

    async function runJob(job: CatalogJob, title: string): Promise<void> {
        try {
            const result = await api.runCatalogJob(job);
            setNotice(
                result.busy
                    ? `"${title}" masuk antrean; menunggu job lain selesai.`
                    : `"${title}" dijalankan.`,
            );
            await loadStats();
        } catch (jobError) {
            setError(jobError instanceof Error ? jobError.message : 'Gagal menjalankan job');
        }
    }

    const totals = (stats?.catalogues ?? []).reduce(
        (sum, row) => ({
            total: sum.total + row.total,
            checked: sum.checked + row.checked,
            withText: sum.withText + row.with_text,
            revoked: sum.revoked + row.revoked,
        }),
        { total: 0, checked: 0, withText: 0, revoked: 0 },
    );

    return (
        <div className="space-y-6">
            <section>
                <h1 className="text-2xl font-semibold tracking-tight">Katalog peraturan.go.id</h1>
                <p className="mt-1 max-w-3xl text-sm opacity-70">
                    Cermin seluruh peraturan di peraturan.go.id yang selalu disinkronkan:
                    peraturan baru, status berlaku/dicabut, dan relasinya. Teks pasalnya dikirim
                    ke Alignment; PDF tetap di peraturan.go.id.
                </p>
            </section>

            {error && (
                <div className="alert alert-error">
                    <span>{error}</span>
                </div>
            )}
            {notice && (
                <div className="alert alert-info alert-soft">
                    <span>{notice}</span>
                    <button type="button" className="btn btn-ghost btn-xs" onClick={() => setNotice('')}>
                        tutup
                    </button>
                </div>
            )}

            <section className="grid grid-cols-2 gap-2 md:grid-cols-4">
                {[
                    { label: 'Peraturan tercatat', value: totals.total },
                    { label: 'Sudah dicek detailnya', value: totals.checked },
                    { label: 'Teks masuk Alignment', value: totals.withText },
                    { label: 'Berstatus dicabut', value: totals.revoked },
                ].map((tile) => (
                    <div key={tile.label} className="card border border-base-content/10 bg-base-200 p-4">
                        <span className="text-xs opacity-70">{tile.label}</span>
                        <span className="text-2xl font-semibold">
                            {stats ? tile.value.toLocaleString('id-ID') : '…'}
                        </span>
                    </div>
                ))}
            </section>

            <section className="card border border-base-content/10 bg-base-200">
                <div className="card-body gap-3 p-4">
                    <h2 className="text-sm font-semibold">Progres per jenis</h2>
                    {!stats && <SkeletonCards rows={3} />}
                    {stats && stats.catalogues.length === 0 && (
                        <p className="text-sm opacity-70">
                            Katalog masih kosong. Sapuan pertama berjalan otomatis setelah
                            kolektor dinyalakan (±1,5 jam), atau jalankan &quot;Sapuan seluruh
                            katalog&quot; di bawah.
                        </p>
                    )}
                    {stats?.catalogues.map((row) => (
                        <div key={row.catalogue} className="grid gap-1 md:grid-cols-[12rem_1fr_auto] md:items-center md:gap-4">
                            <button
                                type="button"
                                className="link-hover text-left text-sm font-medium"
                                onClick={() => {
                                    setCatalogue(row.catalogue);
                                    setPage(1);
                                }}
                            >
                                {CATALOGUE_LABELS[row.catalogue] ?? row.catalogue}
                            </button>
                            <div className="space-y-1">
                                <progress
                                    className="progress progress-primary h-2 w-full"
                                    value={percent(row.with_text, row.total)}
                                    max={100}
                                    title="Teks masuk Alignment"
                                />
                                <progress
                                    className="progress h-1 w-full"
                                    value={percent(row.checked, row.total)}
                                    max={100}
                                    title="Detail sudah dicek"
                                />
                            </div>
                            <span className="text-xs whitespace-nowrap opacity-70">
                                {row.with_text.toLocaleString('id-ID')} teks ·{' '}
                                {row.checked.toLocaleString('id-ID')} dicek /{' '}
                                {row.total.toLocaleString('id-ID')}
                                {row.revoked > 0 && ` · ${row.revoked} dicabut`}
                            </span>
                        </div>
                    ))}
                    <p className="text-xs opacity-60">
                        Bar tebal: teks sudah di Alignment. Bar tipis: status &amp; relasi sudah dicek.
                    </p>
                </div>
            </section>

            <section className="grid gap-3 md:grid-cols-2">
                {JOBS.map(({ job, title, when, what }) => {
                    const report = stats?.jobs[job];
                    const running = Boolean(report && !report.finishedAt);
                    return (
                        <div key={job} className="card border border-base-content/10 bg-base-200">
                            <div className="card-body gap-2 p-4">
                                <div className="flex items-start justify-between gap-2">
                                    <div>
                                        <h3 className="font-medium">{title}</h3>
                                        <p className="text-xs opacity-60">Otomatis {when}</p>
                                    </div>
                                    <button
                                        type="button"
                                        className="btn btn-outline btn-xs"
                                        disabled={running}
                                        onClick={() => void runJob(job, title)}
                                    >
                                        {running ? (
                                            <span className="loading loading-spinner loading-xs" />
                                        ) : (
                                            'Jalankan sekarang'
                                        )}
                                    </button>
                                </div>
                                <p className="text-xs opacity-70">{what}</p>
                                <div className="text-xs">
                                    {!report && <span className="opacity-50">Belum berjalan sejak kolektor dinyalakan.</span>}
                                    {report && (
                                        <>
                                            <span className={report.error ? 'text-error' : running ? 'text-info' : 'text-success'}>
                                                {report.error ? 'Gagal' : running ? 'Sedang berjalan' : 'Selesai'}
                                            </span>{' '}
                                            <span className="opacity-60">
                                                {formatDateTime(report.finishedAt ?? report.startedAt)}
                                                {report.durationSeconds !== null && ` · ${report.durationSeconds} dtk`}
                                            </span>
                                            {Object.keys(report.counts).length > 0 && (
                                                <div className="mt-1 flex flex-wrap gap-1">
                                                    {Object.entries(report.counts).map(([key, value]) => (
                                                        <span key={key} className="badge badge-ghost badge-sm">
                                                            {value} {COUNT_LABELS[key] ?? key}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                            {report.error && <p className="mt-1 text-error/80">{report.error}</p>}
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </section>

            {stats && stats.recentChanges.length > 0 && (
                <section className="card border border-base-content/10 bg-base-200">
                    <div className="card-body gap-2 p-4">
                        <h2 className="text-sm font-semibold">Perubahan 7 hari terakhir</h2>
                        <ul className="divide-y divide-base-content/10 text-sm">
                            {stats.recentChanges.map((change) => (
                                <li key={`${change.sourceId}-${change.field}-${change.changedAt}`} className="py-2">
                                    <div className="font-medium">{change.title}</div>
                                    <div className="text-xs opacity-70">
                                        {change.field === 'status'
                                            ? `Status: ${change.oldValue ?? '—'} → ${change.newValue ?? '—'}`
                                            : change.field === 'pdf_url'
                                              ? 'PDF resmi berganti; teksnya diproses ulang'
                                              : 'Relasi antar peraturan berubah'}{' '}
                                        · {formatDateTime(change.changedAt)}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                </section>
            )}

            <section className="space-y-3">
                <div className="flex flex-col gap-2 md:flex-row md:items-center">
                    <h2 className="text-sm font-semibold whitespace-nowrap md:mr-auto">
                        Daftar peraturan <span className="opacity-60">({total.toLocaleString('id-ID')})</span>
                    </h2>
                    <label className="input input-bordered input-sm flex w-full items-center gap-2 md:max-w-xs">
                        <span className="opacity-50">&#128269;</span>
                        <input
                            type="search"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Cari judul, mis. ketenagakerjaan"
                            className="grow bg-transparent outline-none"
                        />
                    </label>
                    <select
                        value={catalogue}
                        onChange={(event) => {
                            setCatalogue(event.target.value);
                            setPage(1);
                        }}
                        className="select select-bordered select-sm w-full md:w-48"
                    >
                        <option value="">Semua jenis</option>
                        {Object.entries(CATALOGUE_LABELS).map(([key, label]) => (
                            <option key={key} value={key}>
                                {label}
                            </option>
                        ))}
                    </select>
                    <select
                        value={statusFilter}
                        onChange={(event) => {
                            setStatusFilter(event.target.value);
                            setPage(1);
                        }}
                        className="select select-bordered select-sm w-full md:w-40"
                    >
                        <option value="">Semua status</option>
                        <option value="Berlaku">Berlaku</option>
                        <option value="Dicabut%">Dicabut</option>
                    </select>
                </div>

                <Pagination
                    page={page}
                    totalPages={totalPages}
                    total={total}
                    limit={pageSize}
                    pageSizes={PAGE_SIZES}
                    onPageChange={setPage}
                    onLimitChange={(next) => {
                        setPageSize(next);
                        setPage(1);
                    }}
                    disabled={loading}
                    noun="peraturan"
                />

                {loading && <SkeletonCards rows={6} />}
                {!loading && items.length === 0 && (
                    <div className="card border border-dashed border-base-content/20 bg-base-200">
                        <div className="card-body items-center py-10 text-sm opacity-70">
                            Tidak ada peraturan untuk filter ini.
                        </div>
                    </div>
                )}
                {!loading && items.length > 0 && (
                    <div className="overflow-x-auto rounded-box border border-base-content/10 bg-base-200">
                        <table className="table table-sm">
                            <thead>
                                <tr>
                                    <th>Peraturan</th>
                                    <th>Status</th>
                                    <th>Teks</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((regulation) => (
                                    <tr key={regulation.sourceId} className="align-top">
                                        <td className="max-w-2xl">
                                            <a
                                                href={regulation.pageUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="link-hover font-medium"
                                            >
                                                {regulation.title}
                                            </a>
                                            <div className="mt-1 flex flex-wrap gap-2 text-xs opacity-70">
                                                {regulation.issuer && <span>{regulation.issuer}</span>}
                                                {regulation.pdfUrl && (
                                                    <a href={regulation.pdfUrl} target="_blank" rel="noreferrer" className="link">
                                                        PDF resmi
                                                    </a>
                                                )}
                                                {regulation.relations.length > 0 && (
                                                    <span title={regulation.relations.map((r) => `${r.kind}: ${r.target}`).join('\n')}>
                                                        {regulation.relations.length} relasi
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="text-xs whitespace-nowrap">
                                            {regulation.status ? (
                                                <span
                                                    className={`badge badge-sm ${
                                                        regulation.status.toLowerCase().startsWith('dicabut')
                                                            ? 'badge-error badge-soft'
                                                            : 'badge-success badge-soft'
                                                    }`}
                                                >
                                                    {regulation.status}
                                                </span>
                                            ) : (
                                                <span className="opacity-50">belum dicek</span>
                                            )}
                                        </td>
                                        <td>
                                            <span className={`badge badge-sm whitespace-nowrap ${TEXT_STATUS[regulation.textStatus].badge}`}>
                                                {TEXT_STATUS[regulation.textStatus].label}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </div>
    );
}
