'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';

import Pagination from '@/components/pagination';
import { SkeletonCards } from '@/components/skeleton';
import { api } from '@/lib/api';
import type { Run, RunStatus } from '@/lib/types';

const STATUS_LABEL: Record<RunStatus, string> = {
    QUEUED: 'Menunggu antrean',
    RUNNING: 'Sedang berjalan',
    SUCCEEDED: 'Selesai',
    FAILED: 'Gagal',
};

const STATUS_BADGE: Record<RunStatus, string> = {
    QUEUED: 'badge-ghost',
    RUNNING: 'badge-info',
    SUCCEEDED: 'badge-success',
    FAILED: 'badge-error',
};

const PAGE_SIZES = [10, 20, 50, 100] as const;

function formatDateTime(value: string | null): string {
    if (!value) return '—';
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleString('id-ID');
}

export default function RunsPage() {
    const [runs, setRuns] = useState<Run[]>([]);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState<number>(PAGE_SIZES[1]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [live, setLive] = useState(false);

    // Nomor permintaan terakhir. Paginasi ini server-side, jadi menekan ‹ atau ›
    // beruntun meninggalkan beberapa permintaan berjalan sekaligus; tanpa penanda
    // ini yang selesai belakangan akan menimpa yang lebih baru dan tabel
    // menampilkan isi halaman yang bukan sedang ditunjuk.
    const latestRequest = useRef(0);

    const refresh = useCallback(
        async (background = false) => {
            const requestId = ++latestRequest.current;
            if (!background) setLoading(true);
            try {
                const result = await api.runs({ page, limit: pageSize });
                if (requestId !== latestRequest.current) return;
                setRuns(result.items);
                setTotal(result.total);
                setTotalPages(result.totalPages);
                // Run yang selesai bisa menggeser isi halaman; jangan tertinggal di
                // halaman yang sudah tidak ada.
                if (page > result.totalPages) setPage(result.totalPages);
                setError('');
            } catch (refreshError) {
                if (requestId !== latestRequest.current) return;
                setError(
                    refreshError instanceof Error
                        ? refreshError.message
                        : 'Gagal memuat riwayat',
                );
            } finally {
                if (requestId === latestRequest.current) setLoading(false);
            }
        },
        [page, pageSize],
    );

    useEffect(() => {
        // Pemuatan dibungkus fungsi async di dalam effect: React 19 melarang setState
        // sinkron di badan effect karena memicu render berantai.
        void (async () => {
            await refresh();
        })();
    }, [refresh]);

    // Daftar riwayat bergerak sendiri ketika cron menjalankan run di latar belakang.
    // Backend menyiarkan perubahan status seluruh run, bukan baris lognya, jadi halaman
    // ini cukup memuat ulang datanya setiap kali ada sinyal.
    useEffect(() => {
        let disposed = false;
        let controller: AbortController | undefined;
        let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

        const connect = async (): Promise<void> => {
            controller = new AbortController();
            try {
                const response = await fetch('/api/collector/v1/events', {
                    headers: { Accept: 'text/event-stream' },
                    signal: controller.signal,
                });
                if (!response.ok || !response.body) {
                    throw new Error(`Gagal menyambung ke stream (${response.status})`);
                }
                setLive(true);

                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';

                while (!disposed) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    buffer += decoder.decode(value, { stream: true });
                    const frames = buffer.split(/\r?\n\r?\n/);
                    buffer = frames.pop() ?? '';

                    for (const frame of frames) {
                        const payload = frame
                            .split(/\r?\n/)
                            .filter((line) => line.startsWith('data:'))
                            .map((line) => line.slice(5).trim())
                            .join('\n');
                        if (!payload) continue;

                        let event: { type?: string };
                        try {
                            event = JSON.parse(payload) as { type?: string };
                        } catch {
                            continue;
                        }
                        // `ready` hanya penanda sambungan terbuka, bukan perubahan data.
                        if (event.type === 'status') void refresh(true);
                    }
                }
            } catch {
                if (disposed) return;
                reconnectTimer = setTimeout(() => void connect(), 3000);
            } finally {
                if (!disposed) setLive(false);
            }
        };

        void connect();

        return () => {
            disposed = true;
            controller?.abort();
            if (reconnectTimer) clearTimeout(reconnectTimer);
        };
    }, [refresh]);

    const active = runs.filter((run) => run.status === 'QUEUED' || run.status === 'RUNNING').length;

    return (
        <div className="space-y-5">
            <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Riwayat run</h1>
                    <p className="mt-1 text-sm opacity-70">
                        Hasil pengumpulan terakhir, baik yang dipicu manual maupun oleh cron.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {active > 0 && (
                        <span className="badge badge-info badge-sm gap-2">
                            <span className="loading loading-spinner loading-xs" />
                            {active} run aktif
                        </span>
                    )}
                    <span
                        className={`badge badge-sm gap-2 ${live ? 'badge-success badge-soft' : 'badge-ghost'}`}
                        title={
                            live
                                ? 'Terhubung ke backend; daftar ini memperbarui diri sendiri.'
                                : 'Tidak terhubung; daftar tidak ikut bergerak sampai tersambung lagi.'
                        }
                    >
                        <span
                            className={`inline-block h-2 w-2 rounded-full ${live ? 'bg-success' : 'bg-base-content/40'}`}
                        />
                        {live ? 'langsung' : 'terputus'}
                    </span>
                </div>
            </section>

            {error && (
                <div className="alert alert-error">
                    <span>{error}</span>
                </div>
            )}

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
                noun="run"
            />

            {/* Skeleton, bukan spinner: tinggi daftar tetap sama sehingga isi tidak
                melompat begitu datanya tiba. */}
            {loading && <SkeletonCards rows={Math.min(pageSize, 6)} />}

            {!loading && runs.length === 0 && (
                <div className="card border border-dashed border-base-content/20 bg-base-200">
                    <div className="card-body items-center py-10 text-sm opacity-60">
                        Belum ada run.
                    </div>
                </div>
            )}

            <div className="space-y-2">
                {runs.map((run) => {
                    const running = run.status === 'QUEUED' || run.status === 'RUNNING';
                    return (
                        <Link
                            key={run.id}
                            href={`/runs/${run.id}`}
                            className="card border border-base-content/10 bg-base-200 transition-colors hover:border-primary"
                        >
                            <div className="card-body gap-2 p-4">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <p className="flex flex-wrap items-center gap-2 font-medium">
                                        {run.ministryLabel}
                                        <span className="badge badge-ghost badge-sm">
                                            {run.trigger === 'CRON' ? 'terjadwal' : 'manual'}
                                        </span>
                                        {run.dryRun && (
                                            <span className="badge badge-info badge-soft badge-sm">
                                                pratinjau
                                            </span>
                                        )}
                                    </p>
                                    <span className={`badge ${STATUS_BADGE[run.status]} badge-sm`}>
                                        {running && (
                                            <span className="loading loading-spinner loading-xs" />
                                        )}
                                        {STATUS_LABEL[run.status]}
                                    </span>
                                </div>

                                <p className="flex flex-wrap gap-x-2 font-mono text-xs opacity-60">
                                    <span className="whitespace-nowrap">
                                        mulai {formatDateTime(run.startedAt ?? run.createdAt)}
                                    </span>
                                    {run.finishedAt && (
                                        <span className="whitespace-nowrap">
                                            selesai {formatDateTime(run.finishedAt)}
                                        </span>
                                    )}
                                </p>

                                {run.summary && (
                                    <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs">
                                        <span className="whitespace-nowrap opacity-70">
                                            kandidat {run.summary.discovered}
                                        </span>
                                        <span className="whitespace-nowrap opacity-70">
                                            kementerian ini {run.summary.ministry_matched}
                                        </span>
                                        <span className="whitespace-nowrap text-success">
                                            terunggah {run.summary.uploaded}
                                        </span>
                                        <span className="whitespace-nowrap opacity-70">
                                            sudah ada {run.summary.skipped_existing}
                                        </span>
                                        <span
                                            className={`whitespace-nowrap ${
                                                run.summary.failed > 0 ? 'text-error' : 'opacity-70'
                                            }`}
                                        >
                                            gagal {run.summary.failed}
                                        </span>
                                    </div>
                                )}

                                {run.errorMessage && (
                                    <p className="font-mono text-xs text-error">
                                        {run.errorMessage}
                                    </p>
                                )}
                            </div>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}
