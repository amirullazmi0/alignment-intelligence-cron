'use client';

import { use, useEffect, useRef, useState } from 'react';
import Link from 'next/link';

import { SkeletonBar } from '@/components/skeleton';

import { api } from '@/lib/api';
import type { LogLine, Run, RunStatus, RunSummary } from '@/lib/types';

const MAX_RENDERED_LINES = 5000;
const RECONNECT_DELAY_MS = 3000;

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

const LEVEL_COLOR: Record<string, string> = {
    DEBUG: 'text-slate-500',
    INFO: 'text-sky-300',
    WARNING: 'text-amber-300',
    ERROR: 'text-red-400',
    CRITICAL: 'text-red-400',
};

interface SnapshotEvent {
    type: 'snapshot';
    lines: LogLine[];
}

interface StatusEvent {
    type: 'status';
    status: RunStatus;
    summary?: RunSummary;
    errorMessage?: string;
}

type StreamEvent = SnapshotEvent | StatusEvent | LogLine;

function formatTime(value: string): string {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? '--:--:--' : parsed.toLocaleTimeString('id-ID');
}

export default function RunDetailPage({ params }: { params: Promise<{ runId: string }> }) {
    // Next 16 menyerahkan params sebagai Promise; `use()` membukanya di komponen klien.
    const { runId } = use(params);

    const [run, setRun] = useState<Run | null>(null);
    const [lines, setLines] = useState<LogLine[]>([]);
    const [error, setError] = useState('');
    const [autoScroll, setAutoScroll] = useState(true);
    const endOfLogRef = useRef<HTMLDivElement | null>(null);
    const finishedRef = useRef(false);

    useEffect(() => {
        let disposed = false;

        api.run(runId)
            .then((detail) => {
                if (disposed) return;
                setRun(detail.run);
                setLines(detail.lines.slice(-MAX_RENDERED_LINES));
            })
            .catch((detailError: unknown) => {
                if (disposed) return;
                setError(detailError instanceof Error ? detailError.message : 'Gagal memuat run');
            });

        return () => {
            disposed = true;
        };
    }, [runId]);

    useEffect(() => {
        let disposed = false;
        let controller: AbortController | undefined;
        let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

        const connect = async (): Promise<void> => {
            controller = new AbortController();
            try {
                const response = await fetch(`/api/collector/v1/runs/${runId}/events`, {
                    headers: { Accept: 'text/event-stream' },
                    signal: controller.signal,
                });
                if (!response.ok || !response.body) {
                    throw new Error(`Gagal menyambung ke stream (${response.status})`);
                }

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

                        let event: StreamEvent;
                        try {
                            event = JSON.parse(payload) as StreamEvent;
                        } catch {
                            continue;
                        }

                        if (event.type === 'snapshot') {
                            // Snapshot MENGGANTI isi, bukan menambah. Kalau ditambahkan,
                            // setiap sambung-ulang akan menggandakan seluruh log.
                            setLines(event.lines.slice(-MAX_RENDERED_LINES));
                            continue;
                        }
                        if (event.type === 'status') {
                            const statusEvent = event;
                            setRun((previous) =>
                                previous
                                    ? {
                                          ...previous,
                                          status: statusEvent.status,
                                          summary: statusEvent.summary ?? previous.summary,
                                          errorMessage:
                                              statusEvent.errorMessage ?? previous.errorMessage,
                                      }
                                    : previous,
                            );
                            if (
                                statusEvent.status === 'SUCCEEDED' ||
                                statusEvent.status === 'FAILED'
                            ) {
                                finishedRef.current = true;
                            }
                            continue;
                        }
                        if (event.type === 'log') {
                            const logLine = event;
                            setLines((previous) => {
                                const next = [...previous, logLine];
                                return next.length > MAX_RENDERED_LINES
                                    ? next.slice(-MAX_RENDERED_LINES)
                                    : next;
                            });
                        }
                    }
                }
            } catch {
                if (disposed || finishedRef.current) return;
                reconnectTimer = setTimeout(() => void connect(), RECONNECT_DELAY_MS);
            }
        };

        void connect();

        return () => {
            disposed = true;
            controller?.abort();
            if (reconnectTimer) clearTimeout(reconnectTimer);
        };
    }, [runId]);

    useEffect(() => {
        if (!autoScroll) return;
        endOfLogRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, [lines.length, autoScroll]);

    const summary = run?.summary;
    const running = run?.status === 'QUEUED' || run?.status === 'RUNNING';

    return (
        <div className="space-y-5">
            <div>
                <Link href="/runs" className="btn btn-ghost btn-xs">
                    ← Riwayat run
                </Link>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                    {run ? (
                        <h1 className="text-2xl font-semibold tracking-tight">
                            {run.ministryLabel}
                        </h1>
                    ) : (
                        <SkeletonBar width="w-64" className="h-8" />
                    )}
                    {run && (
                        <span className={`badge ${STATUS_BADGE[run.status]} badge-sm`}>
                            {running && <span className="loading loading-spinner loading-xs" />}
                            {STATUS_LABEL[run.status]}
                        </span>
                    )}
                    {run?.dryRun && (
                        <span className="badge badge-info badge-soft badge-sm">pratinjau</span>
                    )}
                </div>
            </div>

            {error && (
                <div className="alert alert-error">
                    <span>{error}</span>
                </div>
            )}
            {run?.errorMessage && (
                <div className="alert alert-error">
                    <span>{run.errorMessage}</span>
                </div>
            )}

            {!run && !error && (
                <section
                    className="stats stats-vertical w-full border border-base-content/10 bg-base-200 sm:stats-horizontal"
                    aria-hidden="true"
                >
                    {Array.from({ length: 5 }, (_, index) => (
                        <div key={index} className="stat gap-2">
                            <SkeletonBar width="w-24" />
                            <SkeletonBar width="w-12" className="h-6" />
                        </div>
                    ))}
                </section>
            )}

            {summary && (
                <section className="stats stats-vertical w-full border border-base-content/10 bg-base-200 sm:stats-horizontal">
                    <Stat label="Kandidat" value={summary.discovered} />
                    <Stat label="Kementerian ini" value={summary.ministry_matched} />
                    <Stat label="Terunggah" value={summary.uploaded} accent="text-success" />
                    <Stat
                        label="Sudah ada"
                        value={summary.skipped_existing}
                        hint="Pernah dikumpulkan sebelumnya, jadi tidak diunggah ulang."
                    />
                    <Stat
                        label="Gagal"
                        value={summary.failed}
                        accent={summary.failed > 0 ? 'text-error' : undefined}
                        hint="Umumnya JDIH sumber sedang mati atau menolak koneksi."
                    />
                </section>
            )}

            <section className="overflow-hidden rounded-lg border border-base-content/10">
                {/* Bilah judul ala jendela terminal */}
                <div className="flex items-center justify-between gap-3 bg-base-300 px-3 py-2">
                    <div className="flex items-center gap-2">
                        <span className="flex gap-1.5">
                            <span className="h-3 w-3 rounded-full bg-red-500/80" />
                            <span className="h-3 w-3 rounded-full bg-amber-400/80" />
                            <span className="h-3 w-3 rounded-full bg-green-500/80" />
                        </span>
                        <span className="ml-2 font-mono text-xs opacity-70">
                            kolektor@jdihn — {lines.length} baris
                        </span>
                    </div>
                    <label className="flex cursor-pointer items-center gap-2 py-0">
                        <input
                            type="checkbox"
                            checked={autoScroll}
                            onChange={(event) => setAutoScroll(event.target.checked)}
                            className="toggle toggle-xs toggle-primary"
                        />
                        <span className="label-text text-xs">Gulir otomatis</span>
                    </label>
                </div>

                <div className="terminal h-[480px] overflow-y-auto px-3 py-2 text-xs leading-relaxed">
                    {lines.length === 0 && !running && (
                        <p className="opacity-50">Tidak ada keluaran.</p>
                    )}
                    {lines.map((line, index) => (
                        <div key={`${line.ts}-${index}`} className="terminal-line">
                            <span className="select-none opacity-40">{formatTime(line.ts)} </span>
                            <span className={LEVEL_COLOR[line.level] ?? 'text-slate-300'}>
                                {line.message}
                            </span>
                        </div>
                    ))}
                    {running && (
                        <div className="terminal-line text-emerald-400">
                            <span className="select-none opacity-40">$ </span>
                            <span className="terminal-cursor" />
                        </div>
                    )}
                    <div ref={endOfLogRef} />
                </div>
            </section>
        </div>
    );
}

function Stat({
    label,
    value,
    hint,
    accent,
}: Readonly<{ label: string; value: number; hint?: string; accent?: string }>) {
    return (
        <div className="stat px-4 py-3" title={hint}>
            <div className="stat-title text-xs">{label}</div>
            <div className={`stat-value text-2xl ${accent ?? ''}`}>{value}</div>
        </div>
    );
}
