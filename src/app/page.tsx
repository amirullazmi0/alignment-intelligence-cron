'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import CronPicker from '@/components/cron-picker';
import NumberField from '@/components/number-field';
import Pagination from '@/components/pagination';
import { SkeletonCards } from '@/components/skeleton';
import { api } from '@/lib/api';
import { buildCron, describeCron, parseCron, DEFAULT_CRON_PARTS, type CronParts } from '@/lib/cron';
import type { MinistryOption, Schedule } from '@/lib/types';

function formatDateTime(value: string | null): string {
    if (!value) return '—';
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleString('id-ID');
}

interface FormState {
    ministry: string;
    cron: CronParts;
    keywords: string;
    documentLimit: number;
    dryRun: boolean;
}

const EMPTY_FORM: FormState = {
    ministry: '',
    cron: DEFAULT_CRON_PARTS,
    keywords: '',
    documentLimit: 10,
    dryRun: true,
};

const PAGE_SIZES = [5, 10, 20] as const;
const SEARCH_DEBOUNCE_MS = 300;

export default function SchedulesPage() {
    const router = useRouter();
    const [ministries, setMinistries] = useState<MinistryOption[]>([]);
    const [schedules, setSchedules] = useState<Schedule[]>([]);
    const [taken, setTaken] = useState<string[]>([]);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    const [form, setForm] = useState<FormState>(EMPTY_FORM);
    /** Berisi id jadwal saat sedang menyunting, `null` saat membuat baru. */
    const [editingId, setEditingId] = useState<string | null>(null);

    const [search, setSearch] = useState('');
    // Kata kunci yang benar-benar dikirim ke server; tertunda sesaat supaya tiap ketikan
    // tidak berubah menjadi satu permintaan.
    const [appliedSearch, setAppliedSearch] = useState('');
    const [pageSize, setPageSize] = useState<number>(PAGE_SIZES[1]);
    const [page, setPage] = useState(1);

    // Nomor permintaan terakhir. Paginasi dan pencarian dijalankan di server, jadi
    // menekan ‹/› beruntun atau mengetik cepat meninggalkan beberapa permintaan
    // berjalan sekaligus; tanpa penanda ini yang selesai belakangan akan menimpa
    // yang lebih baru dan daftar menampilkan halaman yang bukan sedang ditunjuk.
    const latestRequest = useRef(0);

    const refresh = useCallback(async () => {
        const requestId = ++latestRequest.current;
        setLoading(true);
        try {
            const [ministryList, schedulePage] = await Promise.all([
                api.ministries(),
                api.schedules({ page, limit: pageSize, search: appliedSearch }),
            ]);
            if (requestId !== latestRequest.current) return;
            setMinistries(ministryList);
            setSchedules(schedulePage.items);
            setTaken(schedulePage.takenMinistries ?? []);
            setTotal(schedulePage.total);
            setTotalPages(schedulePage.totalPages);
            // Halaman terakhir bisa lenyap setelah penghapusan atau penyaringan.
            if (page > schedulePage.totalPages) setPage(schedulePage.totalPages);
            setError('');
        } catch (refreshError) {
            if (requestId !== latestRequest.current) return;
            setError(
                refreshError instanceof Error ? refreshError.message : 'Gagal memuat data',
            );
        } finally {
            if (requestId === latestRequest.current) setLoading(false);
        }
    }, [page, pageSize, appliedSearch]);

    useEffect(() => {
        // Pemuatan dibungkus fungsi async di dalam effect: React 19 melarang setState
        // sinkron di badan effect karena memicu render berantai.
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

    function startEdit(schedule: Schedule): void {
        setEditingId(schedule.id);
        setForm({
            ministry: schedule.ministry,
            cron: parseCron(schedule.cronExpression),
            keywords: schedule.keywords.join(', '),
            documentLimit: schedule.documentLimit,
            dryRun: schedule.dryRun,
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function cancelEdit(): void {
        setEditingId(null);
        setForm(EMPTY_FORM);
    }

    async function submit(event: React.SyntheticEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();
        if (!form.ministry) {
            setError('Pilih kementerian terlebih dahulu.');
            return;
        }
        const cronExpression = buildCron(form.cron);
        if (!cronExpression) {
            setError('Ekspresi cron tidak boleh kosong.');
            return;
        }
        const payload = {
            cronExpression,
            keywords: form.keywords
                .split(',')
                .map((keyword) => keyword.trim())
                .filter(Boolean),
            documentLimit: form.documentLimit,
            dryRun: form.dryRun,
        };

        setBusy(true);
        try {
            if (editingId) {
                await api.updateSchedule(editingId, payload);
            } else {
                await api.createSchedule({ ...payload, ministry: form.ministry });
            }
            cancelEdit();
            await refresh();
        } catch (submitError) {
            setError(submitError instanceof Error ? submitError.message : 'Gagal menyimpan jadwal');
        } finally {
            setBusy(false);
        }
    }

    async function toggle(schedule: Schedule): Promise<void> {
        setBusy(true);
        try {
            await api.updateSchedule(schedule.id, { isActive: !schedule.isActive });
            await refresh();
        } catch (toggleError) {
            setError(toggleError instanceof Error ? toggleError.message : 'Gagal mengubah jadwal');
        } finally {
            setBusy(false);
        }
    }

    async function remove(schedule: Schedule): Promise<void> {
        if (!window.confirm(`Hapus jadwal ${schedule.ministryLabel}?`)) return;
        setBusy(true);
        try {
            await api.deleteSchedule(schedule.id);
            if (editingId === schedule.id) cancelEdit();
            await refresh();
        } catch (removeError) {
            setError(removeError instanceof Error ? removeError.message : 'Gagal menghapus jadwal');
        } finally {
            setBusy(false);
        }
    }

    async function runNow(schedule: Schedule): Promise<void> {
        setBusy(true);
        try {
            const { runId } = await api.runSchedule(schedule.id);
            router.push(`/runs/${runId}`);
        } catch (runError) {
            setError(runError instanceof Error ? runError.message : 'Gagal menjalankan kolektor');
            setBusy(false);
        }
    }

    // Satu kementerian hanya boleh punya satu jadwal, jadi yang sudah terpakai
    // disembunyikan -- kecuali saat menyunting jadwal itu sendiri.
    const available = ministries.filter(
        (option) => option.value === form.ministry || !taken.includes(option.value),
    );
    // Begitu seluruh kementerian punya jadwal, dropdown menjadi kosong. Tanpa
    // penjelasan, itu terbaca sebagai pemilih yang rusak dan bukan sebagai
    // "memang tidak ada lagi yang bisa ditambahkan".
    const allMinistriesScheduled =
        !loading && editingId === null && ministries.length > 0 && available.length === 0;

    return (
        <div className="space-y-6">
            <section>
                <h1 className="text-2xl font-semibold tracking-tight">Jadwal pengumpulan</h1>
                <p className="mt-1 text-sm opacity-70">
                    Atur kapan kolektor menyusuri JDIHN untuk tiap kementerian.
                </p>
            </section>

            {error && (
                <div className="alert alert-error">
                    <span>{error}</span>
                </div>
            )}

            <section className="card border border-base-content/10 bg-base-200">
                <div className="card-body gap-4">
                    <h2 className="card-title text-base">
                        {editingId ? 'Ubah jadwal' : 'Tambah jadwal'}
                        {editingId && <span className="badge badge-primary badge-sm">edit</span>}
                    </h2>

                    <form className="space-y-4" onSubmit={submit}>
                        <label className="form-control w-full">
                            <span className="mb-1 flex flex-wrap items-center gap-x-2 text-sm font-medium">
                                Kementerian
                                {!loading && ministries.length > 0 && editingId === null && (
                                    <span className="text-xs font-normal opacity-60">
                                        {available.length} dari {ministries.length} belum
                                        terjadwal
                                    </span>
                                )}
                            </span>
                            {/* Selama daftar kementerian belum tiba, tempatnya diisi
                                skeleton setinggi select supaya form tidak bergeser. */}
                            {loading ? (
                                <span className="skeleton h-12 w-full" aria-hidden="true" />
                            ) : (
                                <select
                                    value={form.ministry}
                                    onChange={(event) =>
                                        setForm({ ...form, ministry: event.target.value })
                                    }
                                    className="select select-bordered w-full"
                                    // Kementerian tidak bisa dipindah saat menyunting: itu
                                    // identitas jadwalnya. Hapus lalu buat baru kalau memang
                                    // perlu berpindah.
                                    disabled={busy || editingId !== null || allMinistriesScheduled}
                                >
                                    <option value="">
                                        {allMinistriesScheduled
                                            ? 'Tidak ada kementerian tersisa'
                                            : 'Pilih kementerian'}
                                    </option>
                                    {available.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            )}
                            {allMinistriesScheduled && (
                                <span className="mt-2 text-xs leading-5 opacity-70">
                                    Seluruh {ministries.length} kementerian sudah punya jadwal,
                                    jadi tidak ada lagi yang bisa ditambahkan. Ubah atau hapus
                                    salah satu jadwal di bawah untuk menggantinya.
                                </span>
                            )}
                        </label>

                        <div className="divider my-0 text-xs opacity-60">Jadwal</div>

                        <CronPicker
                            value={form.cron}
                            onChange={(cron) => setForm({ ...form, cron })}
                            disabled={busy}
                        />

                        <div className="divider my-0 text-xs opacity-60">Cakupan</div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <label className="form-control w-full">
                                <span className="label-text mb-1 text-sm font-medium">
                                    Batas dokumen per run
                                </span>
                                <NumberField
                                    value={form.documentLimit}
                                    onChange={(documentLimit) =>
                                        setForm({ ...form, documentLimit })
                                    }
                                    min={1}
                                    max={50}
                                    className="input input-bordered w-full"
                                    disabled={busy}
                                />
                            </label>

                            <label className="form-control w-full">
                                <span className="label-text mb-1 text-sm font-medium">
                                    Keyword tambahan (opsional)
                                </span>
                                <input
                                    value={form.keywords}
                                    onChange={(event) =>
                                        setForm({ ...form, keywords: event.target.value })
                                    }
                                    placeholder="hotel, restoran"
                                    className="input input-bordered w-full"
                                    disabled={busy}
                                />
                                <span className="label-text-alt mt-1 text-xs opacity-70">
                                    Dipisah koma. Tiap keyword menjadi satu pencarian terpisah.
                                </span>
                            </label>
                        </div>

                        {/* Kelas .label milik daisyUI memaksa white-space: nowrap, sehingga
                            kalimat sepanjang ini mendorong seluruh halaman melebihi lebar
                            layar kecil. Baris ini memakai flex biasa supaya teksnya wrap. */}
                        <label className="flex cursor-pointer items-start gap-3">
                            <input
                                type="checkbox"
                                checked={form.dryRun}
                                onChange={(event) =>
                                    setForm({ ...form, dryRun: event.target.checked })
                                }
                                className="toggle toggle-primary toggle-sm mt-0.5 shrink-0"
                                disabled={busy}
                            />
                            <span className="min-w-0 text-sm leading-5">
                                Mode pratinjau — hanya mencari, tanpa mengunduh atau mengunggah
                            </span>
                        </label>

                        <div className="flex gap-2">
                            <button
                                type="submit"
                                disabled={busy || loading || allMinistriesScheduled}
                                className="btn btn-primary btn-sm"
                            >
                                {busy && <span className="loading loading-spinner loading-xs" />}
                                {editingId ? 'Simpan perubahan' : 'Simpan jadwal'}
                            </button>
                            {editingId && (
                                <button
                                    type="button"
                                    onClick={cancelEdit}
                                    disabled={busy}
                                    className="btn btn-ghost btn-sm"
                                >
                                    Batal
                                </button>
                            )}
                        </div>
                    </form>

                    <div className="alert alert-warning alert-soft py-2 text-xs">
                        <span>
                            JDIHN membatasi hasil pencarian sekitar 100 dokumen per keyword, jadi
                            satu run mengumpulkan puluhan dokumen — bukan seluruh arsip sebuah
                            kementerian. Dokumen milik kementerian terpilih diproses lebih dulu,
                            dokumen tingkat nasional lain menyusul sampai batas terpenuhi.
                        </span>
                    </div>
                </div>
            </section>

            <section className="space-y-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <h2 className="text-sm font-semibold whitespace-nowrap">
                        Jadwal tersimpan <span className="opacity-60">({total})</span>
                    </h2>
                    <label className="input input-bordered input-sm flex w-full items-center gap-2 sm:max-w-xs">
                        <span className="opacity-50">&#128269;</span>
                        <input
                            type="search"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Cari kementerian atau keyword"
                            className="grow bg-transparent outline-none"
                        />
                    </label>
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
                    disabled={busy || loading}
                    noun="jadwal"
                />

                {/* Skeleton, bukan spinner: tinggi daftar tetap sama sehingga isi tidak
                    melompat begitu datanya tiba. */}
                {loading && <SkeletonCards rows={Math.min(pageSize, 6)} />}

                {!loading && schedules.length === 0 && (
                    <div className="card border border-dashed border-base-content/20 bg-base-200">
                        <div className="card-body items-center py-10 text-sm opacity-60">
                            {appliedSearch
                                ? `Tidak ada jadwal yang cocok dengan "${appliedSearch}".`
                                : 'Belum ada jadwal. Tambahkan satu di atas.'}
                        </div>
                    </div>
                )}

                <div className="space-y-2">
                    {schedules.map((schedule) => (
                        <article
                            key={schedule.id}
                            className={`card border bg-base-200 ${
                                editingId === schedule.id
                                    ? 'border-primary'
                                    : 'border-base-content/10'
                            }`}
                        >
                            <div className="card-body flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                                <div className="min-w-0 flex-1">
                                    <p className="flex flex-wrap items-center gap-2 font-medium">
                                        {schedule.ministryLabel}
                                        {!schedule.isActive && (
                                            <span className="badge badge-ghost badge-sm">
                                                nonaktif
                                            </span>
                                        )}
                                        {schedule.dryRun && (
                                            <span className="badge badge-info badge-sm badge-soft">
                                                pratinjau
                                            </span>
                                        )}
                                    </p>
                                    <p className="mt-1 text-xs opacity-70">
                                        {describeCron(schedule.cronExpression)} · maks{' '}
                                        {schedule.documentLimit} dokumen · berikutnya{' '}
                                        {formatDateTime(schedule.nextRunAt)}
                                    </p>
                                    {schedule.keywords.length > 0 && (
                                        <p className="mt-1 text-xs opacity-70">
                                            keyword: {schedule.keywords.join(', ')}
                                        </p>
                                    )}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        type="button"
                                        onClick={() => void runNow(schedule)}
                                        disabled={busy}
                                        className="btn btn-primary btn-xs"
                                    >
                                        Jalankan sekarang
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => startEdit(schedule)}
                                        disabled={busy}
                                        className="btn btn-outline btn-xs"
                                    >
                                        Ubah
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => void toggle(schedule)}
                                        disabled={busy}
                                        className="btn btn-outline btn-xs"
                                    >
                                        {schedule.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => void remove(schedule)}
                                        disabled={busy}
                                        className="btn btn-error btn-outline btn-xs"
                                    >
                                        Hapus
                                    </button>
                                </div>
                            </div>
                        </article>
                    ))}
                </div>
            </section>
        </div>
    );
}
