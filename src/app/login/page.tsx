import { redirect } from 'next/navigation';

import LoginForm from '@/app/login/login-form';
import { currentUser } from '@/lib/session';

export const metadata = { title: 'Masuk · Kolektor JDIHN' };

// Sesi dibaca per permintaan; halaman ini tidak boleh dirender sebagai statis.
export const dynamic = 'force-dynamic';

export default async function LoginPage() {
    // Sesi yang masih sah tidak perlu melihat form login lagi.
    if (await currentUser()) redirect('/');

    return (
        <div className="flex min-h-[70vh] items-center justify-center px-4">
            <div className="card w-full max-w-sm border border-base-content/10 bg-base-200">
                <div className="card-body gap-4">
                    <div>
                        <h1 className="text-lg font-semibold tracking-tight">Masuk</h1>
                        <p className="mt-1 text-sm opacity-70">
                            Gunakan akun Alignment Intelligence yang sama. Dashboard ini
                            mengendalikan pengumpulan dokumen, jadi hanya untuk pengguna
                            terdaftar.
                        </p>
                    </div>
                    <LoginForm />
                </div>
            </div>
        </div>
    );
}
