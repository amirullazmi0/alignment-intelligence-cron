import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
    // Frontend memanggil FastAPI lewat route handler di sisi server, bukan langsung dari
    // browser, supaya COLLECTOR_INTERNAL_TOKEN tidak pernah sampai ke klien.
    reactStrictMode: true,

    // Secara bawaan Next hanya melayani aset dev untuk origin `localhost`. Membuka
    // dashboard lewat alamat IP mesin membuat chunk JS dibalas 403 dan koneksi HMR
    // gagal; halamannya tetap tampil karena dirender di server, tapi React tidak pernah
    // hydrate sehingga isian seperti dropdown kementerian macet di "Memuat...".
    //
    // Pencocokannya string persis atau wildcard per-segmen titik -- notasi CIDR tidak
    // dikenali dan akan diam-diam tidak pernah cocok. Pola di bawah menutup rentang
    // privat yang lazim, termasuk 172.x milik adapter WSL/Hyper-V. Alamat publik tetap
    // ditolak, dan konfigurasi ini hanya berlaku pada `next dev`.
    allowedDevOrigins: ['127.0.0.1', '10.*.*.*', '172.*.*.*', '192.168.*.*'],
};

export default nextConfig;
