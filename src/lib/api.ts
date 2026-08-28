import type { LogLine, MinistryOption, Run, Schedule } from './types';

/**
 * Klien API yang dipakai dari browser.
 *
 * Seluruh permintaan lewat `/api/collector/*`, sebuah route handler yang meneruskannya ke
 * FastAPI sambil menyisipkan `COLLECTOR_INTERNAL_TOKEN` di sisi server. Dengan begitu
 * token tidak pernah ikut terkirim ke browser.
 */
const BASE = '/api/collector';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${BASE}${path}`, {
        ...init,
        headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
        cache: 'no-store',
    });
    if (!response.ok) {
        const body = await response.text();
        let message = body;
        try {
            const parsed = JSON.parse(body) as { detail?: string };
            message = parsed.detail ?? body;
        } catch {
            // biarkan pesan apa adanya
        }
        throw new Error(message || `Permintaan gagal (${response.status})`);
    }
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
}

export interface Page<T> {
    items: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export interface SchedulePage extends Page<Schedule> {
    /** Semua kementerian yang sudah punya jadwal, lintas halaman. */
    takenMinistries: string[];
}

/**
 * Samakan bentuk respons daftar berhalaman.
 *
 * Backend versi lama membalas array polos, bukan objek berhalaman. Tanpa penyeragaman
 * ini, halaman akan gagal dengan `TypeError` yang tidak menjelaskan apa-apa hanya karena
 * backend belum di-restart. Array yang diterima diperlakukan sebagai satu halaman penuh,
 * sehingga aplikasi tetap terpakai walau paginasinya belum aktif.
 */
function toPage<T>(payload: unknown, fallbackLimit: number): Page<T> {
    if (Array.isArray(payload)) {
        const items = payload as T[];
        return {
            items,
            total: items.length,
            page: 1,
            limit: fallbackLimit,
            totalPages: 1,
        };
    }
    const record = (payload ?? {}) as Partial<Page<T>>;
    const items = Array.isArray(record.items) ? record.items : [];
    return {
        items,
        total: typeof record.total === 'number' ? record.total : items.length,
        page: typeof record.page === 'number' ? record.page : 1,
        limit: typeof record.limit === 'number' ? record.limit : fallbackLimit,
        totalPages: typeof record.totalPages === 'number' ? record.totalPages : 1,
    };
}

export const api = {
    ministries: async () => (await request<MinistryOption[]>('/v1/ministries')) ?? [],
    schedules: async (params: {
        page: number;
        limit: number;
        search: string;
    }): Promise<SchedulePage> => {
        const query = new URLSearchParams({
            page: String(params.page),
            limit: String(params.limit),
        });
        if (params.search.trim()) query.set('search', params.search.trim());
        const payload = await request<unknown>(`/v1/schedules?${query.toString()}`);
        const page = toPage<Schedule>(payload, params.limit);
        const taken = (payload as Partial<SchedulePage> | null)?.takenMinistries;
        return {
            ...page,
            // Backend lama tidak mengirim daftar ini; jatuh ke kementerian yang tampil
            // di halaman ini supaya dropdown tetap masuk akal.
            takenMinistries: Array.isArray(taken)
                ? taken
                : page.items.map((schedule) => schedule.ministry),
        };
    },
    createSchedule: (body: Record<string, unknown>) =>
        request<Schedule>('/v1/schedules', { method: 'POST', body: JSON.stringify(body) }),
    updateSchedule: (id: string, body: Record<string, unknown>) =>
        request<Schedule>(`/v1/schedules/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    deleteSchedule: (id: string) =>
        request<void>(`/v1/schedules/${id}`, { method: 'DELETE' }),
    runSchedule: (id: string) =>
        request<{ runId: string; queueLength: number }>(`/v1/schedules/${id}/run`, {
            method: 'POST',
        }),
    runs: async (params: { page: number; limit: number }): Promise<Page<Run>> =>
        toPage<Run>(
            await request<unknown>(`/v1/runs?page=${params.page}&limit=${params.limit}`),
            params.limit,
        ),
    run: (id: string) => request<{ run: Run; lines: LogLine[] }>(`/v1/runs/${id}`),
};
