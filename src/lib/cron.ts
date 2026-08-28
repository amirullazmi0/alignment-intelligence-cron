/**
 * Pembentuk dan pembaca ekspresi cron 5 kolom (menit jam tanggal bulan hari).
 *
 * Dipakai agar pengguna memilih jadwal lewat kategori yang mudah dipahami, bukan
 * mengetik cron mentah. Ekspresi yang dihasilkan tetap ditampilkan supaya bisa
 * diperiksa, dan tetap divalidasi ulang di backend oleh APScheduler.
 */

export type Frequency = 'minutely' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'custom';

export interface CronParts {
    frequency: Frequency;
    /** Untuk `minutely`: jarak dalam menit. Untuk `hourly`: jarak dalam jam. */
    interval: number;
    /** Menit dalam jam, 0-59. Dipakai selain `minutely`. */
    minute: number;
    /** Jam dalam hari, 0-23. Dipakai `daily`, `weekly`, `monthly`. */
    hour: number;
    /** 0 = Minggu ... 6 = Sabtu. Dipakai `weekly`. */
    weekday: number;
    /** Tanggal 1-28. Dipakai `monthly`. */
    day: number;
    /** Ekspresi mentah, dipakai saat `frequency` = `custom`. */
    expression: string;
}

export const DEFAULT_CRON_PARTS: CronParts = {
    frequency: 'daily',
    interval: 30,
    minute: 0,
    hour: 2,
    weekday: 1,
    day: 1,
    expression: '0 2 * * *',
};

export const FREQUENCY_LABELS: ReadonlyArray<{ value: Frequency; label: string }> = [
    { value: 'minutely', label: 'Per menit' },
    { value: 'hourly', label: 'Per jam' },
    { value: 'daily', label: 'Per hari' },
    { value: 'weekly', label: 'Per minggu' },
    { value: 'monthly', label: 'Per bulan' },
    { value: 'custom', label: 'Kustom (cron)' },
];

export const WEEKDAYS: ReadonlyArray<{ value: number; label: string }> = [
    { value: 0, label: 'Minggu' },
    { value: 1, label: 'Senin' },
    { value: 2, label: 'Selasa' },
    { value: 3, label: 'Rabu' },
    { value: 4, label: 'Kamis' },
    { value: 5, label: 'Jumat' },
    { value: 6, label: 'Sabtu' },
];

/**
 * Jarak terpendek yang diizinkan untuk jadwal menitan.
 *
 * Collector menjalankan run satu per satu dan menahan jeda kesopanan pada tiap
 * permintaan ke JDIHN, sehingga satu run bisa memakan beberapa menit. Jadwal yang lebih
 * rapat dari ini hanya akan menumpuk di antrean tanpa menambah dokumen.
 */
export const MIN_MINUTE_INTERVAL = 5;

function clamp(value: number, low: number, high: number): number {
    if (!Number.isFinite(value)) return low;
    return Math.min(high, Math.max(low, Math.trunc(value)));
}

function pad(value: number): string {
    return value.toString().padStart(2, '0');
}

export function buildCron(parts: CronParts): string {
    const minute = clamp(parts.minute, 0, 59);
    const hour = clamp(parts.hour, 0, 23);

    switch (parts.frequency) {
        case 'minutely': {
            const step = clamp(parts.interval, MIN_MINUTE_INTERVAL, 59);
            return `*/${step} * * * *`;
        }
        case 'hourly': {
            const step = clamp(parts.interval, 1, 23);
            return `${minute} */${step} * * *`;
        }
        case 'weekly':
            return `${minute} ${hour} * * ${clamp(parts.weekday, 0, 6)}`;
        case 'monthly':
            // Dibatasi 28 supaya jadwal tidak pernah terlewat di Februari.
            return `${minute} ${hour} ${clamp(parts.day, 1, 28)} * *`;
        case 'custom':
            return parts.expression.trim();
        case 'daily':
        default:
            return `${minute} ${hour} * * *`;
    }
}

/**
 * Baca kembali ekspresi cron menjadi pilihan kategori.
 *
 * Dipakai saat menyunting jadwal yang sudah tersimpan. Ekspresi yang tidak cocok dengan
 * pola mana pun dikembalikan sebagai `custom`, jadi jadwal yang ditulis manual di
 * database tidak pernah salah ditafsirkan menjadi sesuatu yang lain.
 */
export function parseCron(expression: string): CronParts {
    const fallback: CronParts = { ...DEFAULT_CRON_PARTS, frequency: 'custom', expression };
    const fields = expression.trim().split(/\s+/);
    if (fields.length !== 5) return fallback;

    const [minuteField, hourField, dayField, monthField, weekdayField] = fields;
    if (monthField !== '*') return fallback;

    const asNumber = (value: string): number | null => {
        if (!/^\d+$/.test(value)) return null;
        return Number(value);
    };
    const asStep = (value: string): number | null => {
        const match = /^\*\/(\d+)$/.exec(value);
        return match ? Number(match[1]) : null;
    };

    const minuteStep = asStep(minuteField);
    if (minuteStep !== null && hourField === '*' && dayField === '*' && weekdayField === '*') {
        return { ...fallback, frequency: 'minutely', interval: minuteStep, expression };
    }

    const minute = asNumber(minuteField);
    if (minute === null) return fallback;

    const hourStep = asStep(hourField);
    if (hourStep !== null && dayField === '*' && weekdayField === '*') {
        return { ...fallback, frequency: 'hourly', interval: hourStep, minute, expression };
    }

    const hour = asNumber(hourField);
    if (hour === null) return fallback;

    if (dayField === '*' && weekdayField === '*') {
        return { ...fallback, frequency: 'daily', minute, hour, expression };
    }

    const weekday = asNumber(weekdayField);
    if (dayField === '*' && weekday !== null && weekday <= 6) {
        return { ...fallback, frequency: 'weekly', minute, hour, weekday, expression };
    }

    const day = asNumber(dayField);
    if (weekdayField === '*' && day !== null && day >= 1 && day <= 31) {
        return { ...fallback, frequency: 'monthly', minute, hour, day, expression };
    }

    return fallback;
}

/** Keterangan berbahasa Indonesia untuk sebuah ekspresi cron. */
export function describeCron(expression: string): string {
    const parts = parseCron(expression);
    const at = `${pad(parts.hour)}.${pad(parts.minute)}`;

    switch (parts.frequency) {
        case 'minutely':
            return `Setiap ${parts.interval} menit`;
        case 'hourly':
            return `Setiap ${parts.interval} jam, pada menit ke-${parts.minute}`;
        case 'daily':
            return `Setiap hari pukul ${at}`;
        case 'weekly': {
            const day = WEEKDAYS.find((item) => item.value === parts.weekday)?.label ?? '-';
            return `Setiap ${day} pukul ${at}`;
        }
        case 'monthly':
            return `Setiap tanggal ${parts.day} pukul ${at}`;
        default:
            return `Cron kustom: ${expression}`;
    }
}
