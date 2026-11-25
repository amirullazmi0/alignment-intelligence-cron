'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import Pagination from '@/components/pagination';
import { SkeletonCards } from '@/components/skeleton';
import { api } from '@/lib/api';
import {
    DOCUMENT_STATUS,
    SOURCE_LABELS,
    type CollectedDocument,
    type CollectorSource,
    type DocumentStatus,
} from '@/lib/types';

const PAGE_SIZES = [20, 50, 100] as const;
const SEARCH_DEBOUNCE_MS = 300;
const STATUS_ORDER: DocumentStatus[] = [
    'UPLOADED',
    'DUPLICATE',
    'FAILED_RETRYABLE',
    'FAILED_PERMANENT',
    'SKIPPED_NO_PDF',
    'SOURCE_CHANGED',
    'PARSE_FAILED',
    'DISCOVERED',
];

function formatDateTime(value: string | null): string {
    if (!value) return '—';
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleString('id-ID');
}

export default function DocumentsPage() {
    return (
        <Suspense fallback={<SkeletonCards rows={6} />}>
            <Documents />
        </Suspense>
    );
}

function Documents() {
    const router = useRouter();
    const pathname = usePathname();
    const params = useSearchParams();
    const status = params.get('status') ?? '';
    const source = params.get('source') ?? '';
    const runId = params.get('runId') ?? '';
    const scheduleId = params.get('scheduleId') ?? '';

    const [items, setItems] = useState<CollectedDocument[]>([]);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [counts, setCounts] = useState<Record<string, number>>({});
    const [scopeLabel, setScopeLabel] = useState('');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState<number>(PAGE_SIZES[0]);
    const [search, setSearch] = useState('');
    const [appliedSearch, setAppliedSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const latestRequest = useRef(0);

    /** Ubah satu filter di URL, supaya tampilan bisa dibagikan dan tombol Kembali bekerja. */
    const setFilter = useCallback(
        (key: string, value: string) => {
            const next = new URLSearchParams(params.toString());
            if (value) next.set(key, value);
            else next.delete(key);
            setPage(1);
            router.replace(`${pathname}?${next.toString()}`);
        },
        [params, pathname, router],
    );

    const refresh = useCallback(async () => {
        const requestId = ++latestRequest.current;
        setLoading(true);
        try {
            const [result, stats] = await Promise.all([
                api.documents({
                    page,
                    limit: pageSize,
                    status,
                    source,
                    runId,
                    scheduleId,
                    search: appliedSearch.trim(),
                }),
                api.documentStats(),
            ]);
            if (requestId !== latestRequest.current) return;
            setItems(result.items);
            setTotal(result.total);
            setTotalPages(result.totalPages);
            setCounts(stats);
            if (page > result.totalPages) setPage(result.totalPages);
            setError('');
        } catch (refreshError) {
            if (requestId !== latestRequest.current) return;
            setError(refreshError instanceof Error ? refreshError.message : 'Gagal memuat dokumen');
        } finally {
            if (requestId === latestRequest.current) setLoading(false);
        }
    }, [page, pageSize, status, source, runId, scheduleId, appliedSearch]);

    useEffect(() => {
        void (async () => {
            await refresh();
        })();
    }, [refresh]);

    useEffect(() => {
        const timer = setTimeout(() => {
            setAppliedSearch(search);
            setPage(1);
        }, SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [search]);

    // Nama jadwal untuk chip filter, supaya tidak hanya menampilkan id.
    useEffect(() => {
        void (async () => {
            if (scheduleId) {
                const schedule = await api.schedule(scheduleId).catch(() => null);
                setScopeLabel(schedule ? `Jadwal: ${schedule.ministryLabel}` : 'Jadwal terpilih');
            } else if (runId) {
                setScopeLabel(`Run ${runId.slice(0, 8)}`);
            } else {
                setScopeLabel('');
            }
        })();
    }, [scheduleId, runId]);

    const totalAll = Object.values(counts).reduce((sum, value) => sum + value, 0);

    return (
        <div className="space-y-6">
            <section>
                <h1 className="text-2xl font-semibold tracking-tight">Dokumen terkumpul</h1>
                <p className="mt-1 text-sm opacity-70">
                    Semua dokumen yang pernah ditangani kolektor, dari run mana asalnya, dan
                    apakah sudah masuk ke Alignment. Klik kotak status untuk menyaring.
                </p>
            </section>

            {/* Ringkasan per status sekaligus filter. */}
            <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <button
                    type="button"
                    onClick={() => setFilter('status', '')}
                    className={`card border p-3 text-left transition ${
                        status === '' ? 'border-primary bg-primary/10' : 'border-base-content/10 bg-base-200 hover:border-base-content/30'
                    }`}
                >
                    <span className="text-xs opacity-70">Semua</span>
                    <span className="text-2xl font-semibold">{totalAll.toLocaleString('id-ID')}</span>
                </button>
                {STATUS_ORDER.filter((key) => (counts[key] ?? 0) > 0 || key === status).map(
                    (key) => (
                        <button
                            key={key}
                            type="button"
                            title={DOCUMENT_STATUS[key].hint}
                            onClick={() => setFilter('status', status === key ? '' : key)}
                            className={`card border p-3 text-left transition ${
                                status === key
                                    ? 'border-primary bg-primary/10'
                                    : 'border-base-content/10 bg-base-200 hover:border-base-content/30'
                            }`}
                        >
                            <span className="flex items-center gap-1 text-xs opacity-80">
                                <span className={`badge badge-xs ${DOCUMENT_STATUS[key].badge}`} />
                                {DOCUMENT_STATUS[key].label}
                            </span>
                            <span className="text-2xl font-semibold">
                                {(counts[key] ?? 0).toLocaleString('id-ID')}
                            </span>
                        </button>
                    ),
                )}
            </section>

            {error && (
                <div className="alert alert-error">
                    <span>{error}</span>
                </div>
            )}

            <section className="flex flex-col gap-3 md:flex-row md:items-center">
                <label className="input input-bordered input-sm flex w-full items-center gap-2 md:max-w-sm">
                    <span className="opacity-50">&#128269;</span>
                    <input
                        type="search"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Cari judul atau instansi"
                        className="grow bg-transparent outline-none"
                    />
                </label>
                <select
                    value={source}
                    onChange={(event) => setFilter('source', event.target.value)}
                    className="select select-bordered select-sm w-full md:w-56"
                >
                    <option value="">Semua sumber</option>
                    {(Object.keys(SOURCE_LABELS) as CollectorSource[]).map((key) => (
                        <option key={key} value={key}>
                            {SOURCE_LABELS[key]}
                        </option>
                    ))}
                </select>
                {scopeLabel && (
                    <span className="badge badge-primary gap-2 py-3">
                        {scopeLabel}
                        <button
                            type="button"
                            aria-label="Hapus filter"
                            onClick={() => {
                                const next = new URLSearchParams(params.toString());
                                next.delete('runId');
                                next.delete('scheduleId');
                                router.replace(`${pathname}?${next.toString()}`);
                            }}
                        >
                            ✕
                        </button>
                    </span>
                )}
            </section>

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
                noun="dokumen"
            />

            {loading && <SkeletonCards rows={6} />}

            {!loading && items.length === 0 && (
                <div className="card border border-dashed border-base-content/20 bg-base-200">
                    <div className="card-body items-center py-10 text-center text-sm opacity-70">
                        Belum ada dokumen untuk filter ini.
                        {(runId || scheduleId) && (
                            <span className="text-xs">
                                Dokumen dari run sebelum fitur ini dirilis belum tercatat asal
                                run-nya.
                            </span>
                        )}
                    </div>
                </div>
            )}

            {!loading && items.length > 0 && (
                <div className="overflow-x-auto rounded-box border border-base-content/10 bg-base-200">
                    <table className="table table-sm">
                        <thead>
                            <tr>
                                <th>Dokumen</th>
                                <th>Status</th>
                                <th className="hidden md:table-cell">Asal</th>
                                <th className="hidden lg:table-cell">Terakhir diproses</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((document) => (
                                <tr key={document.sourceId} className="align-top">
                                    <td className="max-w-xl">
                                        <a
                                            href={document.sourceUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="link-hover font-medium"
                                        >
                                            {document.title}
                                        </a>
                                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs opacity-70">
                                            <span className="badge badge-outline badge-xs">
                                                {SOURCE_LABELS[document.source]}
                                            </span>
                                            {document.institution && <span>{document.institution}</span>}
                                            {document.attachmentUrl && (
                                                <a
                                                    href={document.attachmentUrl}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="link"
                                                >
                                                    PDF
                                                </a>
                                            )}
                                        </div>
                                        {document.errorMessage && (
                                            <p className="mt-1 text-xs text-error/80">
                                                {document.errorCode}: {document.errorMessage}
                                            </p>
                                        )}
                                    </td>
                                    <td>
                                        <span
                                            className={`badge badge-sm whitespace-nowrap ${DOCUMENT_STATUS[document.status]?.badge ?? 'badge-ghost'}`}
                                            title={DOCUMENT_STATUS[document.status]?.hint}
                                        >
                                            {DOCUMENT_STATUS[document.status]?.label ?? document.status}
                                        </span>
                                        {document.attempts > 1 && (
                                            <div className="mt-1 text-[11px] opacity-60">
                                                {document.attempts}× percobaan
                                            </div>
                                        )}
                                    </td>
                                    <td className="hidden text-xs md:table-cell">
                                        {document.runId ? (
                                            <Link href={`/runs/${document.runId}`} className="link">
                                                {document.runLabel ?? 'Run'}
                                            </Link>
                                        ) : (
                                            <span className="opacity-50">—</span>
                                        )}
                                    </td>
                                    <td className="hidden text-xs whitespace-nowrap opacity-70 lg:table-cell">
                                        {formatDateTime(document.updatedAt)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
