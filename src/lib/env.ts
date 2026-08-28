/**
 * Konfigurasi runtime dashboard.
 *
 * Alamat layanan tidak pernah punya nilai bawaan. Default seperti
 * `?? 'http://127.0.0.1:5003'` membuat konfigurasi yang salah lolos tanpa suara,
 * lalu aplikasi memanggil alamat yang keliru dan gejalanya baru muncul jauh
 * kemudian sebagai 404 yang membingungkan. Lebih baik berhenti saat itu juga
 * dengan menyebut variabel mana yang belum diisi.
 */

function required(name: string): string {
    const value = process.env[name]?.trim();
    if (!value) {
        throw new Error(
            `${name} belum diisi. Setel di .env untuk pengembangan lokal, atau di ` +
                'dashboard CapRover untuk deployment — berkas .env tidak ikut ke image.',
        );
    }
    return value;
}

/** Alamat backend collector (FastAPI). Hanya dibaca di sisi server. */
export function collectorApiUrl(): string {
    return required('COLLECTOR_API_URL').replace(/\/+$/, '');
}

/**
 * Token internal kolektor. Boleh kosong, dan konsekuensinya harus disadari:
 * tanpa token, siapa pun yang bisa menjangkau backend bisa memicu run. Karena itu
 * ketiadaannya diperingatkan, bukan didiamkan.
 */
export function collectorInternalToken(): string {
    const token = process.env.COLLECTOR_INTERNAL_TOKEN?.trim() ?? '';
    if (!token && process.env.NODE_ENV === 'production') {
        console.warn(
            'COLLECTOR_INTERNAL_TOKEN kosong: endpoint backend collector tidak terlindungi.',
        );
    }
    return token;
}
