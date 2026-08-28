'use client';

import { useState } from 'react';

interface Props {
    value: number;
    onChange: (value: number) => void;
    min: number;
    max: number;
    disabled?: boolean;
    className?: string;
    id?: string;
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

/**
 * Input angka bulat yang benar-benar menolak nilai tidak sah.
 *
 * Atribut `min`/`max` bawaan HTML hanya berlaku saat validasi form dan tombol panah;
 * mengetik langsung tetap bisa menghasilkan `0`, angka berawalan nol seperti `0123`,
 * atau kolom kosong yang terbaca sebagai `0`. Komponen ini menyaringnya:
 *
 * - hanya digit yang diterima, dan awalan nol dibuang saat mengetik;
 * - batas atas ditegakkan langsung supaya angka mustahil tidak pernah tampil;
 * - batas bawah baru ditegakkan saat kolom ditinggalkan, sehingga angka dua digit
 *   masih bisa diketik satu per satu (mengetik "1" menuju "15" tidak langsung
 *   dipaksa menjadi batas minimum);
 * - kolom yang dikosongkan dipulihkan ke batas bawah, bukan menjadi nol.
 */
export default function NumberField({
    value,
    onChange,
    min,
    max,
    disabled = false,
    className = '',
    id,
}: Readonly<Props>) {
    const [draft, setDraft] = useState<string>(String(value));
    const [lastValue, setLastValue] = useState<number>(value);

    // Selaraskan saat nilai diganti dari luar, misalnya ketika form diisi ulang untuk
    // menyunting jadwal. Disesuaikan saat render, bukan di dalam effect: React 19
    // melarang setState sinkron di badan effect.
    if (value !== lastValue) {
        setLastValue(value);
        setDraft(String(value));
    }

    function handleChange(raw: string): void {
        const digits = raw.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
        if (digits === '') {
            setDraft('');
            return;
        }
        const bounded = Math.min(Number(digits), max);
        setDraft(String(bounded));
        if (bounded >= min) {
            setLastValue(bounded);
            onChange(bounded);
        }
    }

    function handleBlur(): void {
        const settled = draft === '' ? min : clamp(Number(draft), min, max);
        setDraft(String(settled));
        setLastValue(settled);
        onChange(settled);
    }

    return (
        <input
            id={id}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={draft}
            onChange={(event) => handleChange(event.target.value)}
            onBlur={handleBlur}
            className={className}
            disabled={disabled}
        />
    );
}
