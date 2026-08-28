'use client';

import NumberField from '@/components/number-field';
import {
    buildCron,
    describeCron,
    FREQUENCY_LABELS,
    MIN_MINUTE_INTERVAL,
    WEEKDAYS,
    type CronParts,
    type Frequency,
} from '@/lib/cron';

interface Props {
    value: CronParts;
    onChange: (parts: CronParts) => void;
    disabled?: boolean;
}

/**
 * Pemilih jadwal dua tingkat: frekuensi dulu, lalu detail yang relevan saja.
 *
 * Ekspresi cron yang terbentuk selalu ditampilkan agar bisa diperiksa, dan mode
 * "Kustom" tetap tersedia untuk pola yang tidak tercakup pilihan mana pun.
 */
export default function CronPicker({ value, onChange, disabled = false }: Readonly<Props>) {
    const expression = buildCron(value);

    function patch(changes: Partial<CronParts>): void {
        onChange({ ...value, ...changes });
    }

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <span className="label-text text-sm font-medium">Frekuensi</span>
                {/* Grid, bukan satu baris join: enam pilihan tidak muat berdampingan di
                    kolom form yang sempit maupun di layar kecil. */}
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                    {FREQUENCY_LABELS.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() => patch({ frequency: option.value as Frequency })}
                            disabled={disabled}
                            className={`btn btn-sm ${
                                value.frequency === option.value ? 'btn-primary' : 'btn-outline'
                            }`}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                {value.frequency === 'minutely' && (
                    <label className="form-control w-full sm:col-span-2">
                        <span className="label-text mb-1 text-sm font-medium">
                            Jalankan setiap (menit)
                        </span>
                        <NumberField
                            value={value.interval}
                            onChange={(interval) => patch({ interval })}
                            min={MIN_MINUTE_INTERVAL}
                            max={59}
                            className="input input-bordered w-full"
                            disabled={disabled}
                        />
                        <span className="label-text-alt mt-1 text-xs opacity-70">
                            Minimal {MIN_MINUTE_INTERVAL} menit. Kolektor menjalankan run satu per
                            satu dan menahan jeda pada tiap permintaan ke JDIHN, jadi jadwal yang
                            lebih rapat hanya menumpuk di antrean.
                        </span>
                    </label>
                )}

                {value.frequency === 'hourly' && (
                    <>
                        <label className="form-control w-full">
                            <span className="label-text mb-1 text-sm font-medium">
                                Jalankan setiap (jam)
                            </span>
                            <NumberField
                                value={value.interval}
                                onChange={(interval) => patch({ interval })}
                                min={1}
                                max={23}
                                className="input input-bordered w-full"
                                disabled={disabled}
                            />
                        </label>
                        <label className="form-control w-full">
                            <span className="label-text mb-1 text-sm font-medium">
                                Pada menit ke-
                            </span>
                            <NumberField
                                value={value.minute}
                                onChange={(minute) => patch({ minute })}
                                min={0}
                                max={59}
                                className="input input-bordered w-full"
                                disabled={disabled}
                            />
                        </label>
                    </>
                )}

                {value.frequency === 'weekly' && (
                    <label className="form-control w-full">
                        <span className="label-text mb-1 text-sm font-medium">Hari</span>
                        <select
                            value={value.weekday}
                            onChange={(event) => patch({ weekday: Number(event.target.value) })}
                            className="select select-bordered w-full"
                            disabled={disabled}
                        >
                            {WEEKDAYS.map((day) => (
                                <option key={day.value} value={day.value}>
                                    {day.label}
                                </option>
                            ))}
                        </select>
                    </label>
                )}

                {value.frequency === 'monthly' && (
                    <label className="form-control w-full">
                        <span className="label-text mb-1 text-sm font-medium">Tanggal</span>
                        <select
                            value={value.day}
                            onChange={(event) => patch({ day: Number(event.target.value) })}
                            className="select select-bordered w-full"
                            disabled={disabled}
                        >
                            {Array.from({ length: 28 }, (_, index) => index + 1).map((day) => (
                                <option key={day} value={day}>
                                    {day}
                                </option>
                            ))}
                        </select>
                        <span className="label-text-alt mt-1 text-xs opacity-70">
                            Dibatasi sampai tanggal 28 supaya jadwal tidak pernah terlewat di
                            bulan Februari.
                        </span>
                    </label>
                )}

                {(value.frequency === 'daily' ||
                    value.frequency === 'weekly' ||
                    value.frequency === 'monthly') && (
                    <label className="form-control w-full">
                        <span className="label-text mb-1 text-sm font-medium">Pukul</span>
                        <input
                            type="time"
                            value={`${String(value.hour).padStart(2, '0')}:${String(value.minute).padStart(2, '0')}`}
                            onChange={(event) => {
                                const [hour, minute] = event.target.value.split(':').map(Number);
                                patch({ hour: hour || 0, minute: minute || 0 });
                            }}
                            className="input input-bordered w-full"
                            disabled={disabled}
                        />
                    </label>
                )}

                {value.frequency === 'custom' && (
                    <label className="form-control w-full sm:col-span-2">
                        <span className="label-text mb-1 text-sm font-medium">Ekspresi cron</span>
                        <input
                            value={value.expression}
                            onChange={(event) => patch({ expression: event.target.value })}
                            placeholder="0 2 * * *"
                            className="input input-bordered w-full font-mono"
                            disabled={disabled}
                        />
                        <span className="label-text-alt mt-1 text-xs opacity-70">
                            Lima kolom: menit jam tanggal bulan hari. Divalidasi saat disimpan.
                        </span>
                    </label>
                )}
            </div>

            <div className="alert alert-soft py-2 text-sm">
                <span>
                    {describeCron(expression)}{' '}
                    <code className="ml-1 font-mono text-primary">{expression}</code>
                </span>
            </div>
        </div>
    );
}
