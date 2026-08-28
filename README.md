# Alignment Intelligence Cron

Dashboard penjadwalan dan pemantauan kolektor regulasi JDIHN. Aplikasi ini hanya
antarmuka; seluruh pekerjaan dilakukan oleh backend collector
(`alignment-intelligence-collector`), yang menyusuri JDIHN, mengunduh PDF, dan
mengunggahnya ke Knowledge Library.

## Menjalankan

```bash
yarn install
cp .env.example .env.local
yarn dev
```

Halaman terbuka di <http://localhost:3100>. Backend collector harus berjalan lebih dulu:

```bash
cd ../alignment-intelligence-collector
yarn serve
```

## Konfigurasi

| Variabel | Arti |
|---|---|
| `COLLECTOR_API_URL` | Alamat backend collector, default `http://127.0.0.1:5003` |
| `COLLECTOR_INTERNAL_TOKEN` | Harus sama dengan milik backend; kosongkan kalau backend tidak memakainya |

Keduanya hanya dibaca di sisi server. Browser tidak pernah memanggil backend secara
langsung: seluruh permintaan lewat route handler `src/app/api/collector/[...path]/route.ts`,
yang menyisipkan token dan meneruskan respons apa adanya sebagai stream — itulah yang
membuat log run tetap mengalir baris demi baris, bukan menumpuk sampai run selesai.

## Halaman

- `/` — daftar jadwal per kementerian: tambah, aktifkan/nonaktifkan, hapus, dan
  "jalankan sekarang".
- `/runs` — riwayat run beserta ringkasannya.
- `/runs/[runId]` — log berjalan secara langsung.

## Catatan hasil

JDIHN membatasi hasil pencarian sekitar 100 dokumen per keyword, jadi satu run
mengumpulkan puluhan dokumen, bukan seluruh arsip sebuah kementerian. Angka
`sudah ada di pustaka` yang besar pada run kedua adalah perilaku normal: dokumen yang
pernah dikumpulkan tidak diunggah ulang.

## Perintah

```bash
yarn dev        # pengembangan di port 3100
yarn build      # build produksi
yarn lint       # eslint
yarn typecheck  # tsc --noEmit
```
# alignment-intelligence-cron
