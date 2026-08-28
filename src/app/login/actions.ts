'use server';

import { redirect } from 'next/navigation';

import { signIn, signOut } from '@/lib/session';

export interface LoginState {
    error: string;
}

/**
 * Aksi form login.
 *
 * Kredensial hanya melintas di sisi server, jadi kata sandi tidak pernah menjadi bagian
 * dari bundel klien maupun riwayat permintaan browser.
 */
export async function loginAction(_previous: LoginState, formData: FormData): Promise<LoginState> {
    const emailField = formData.get('email');
    const passwordField = formData.get('password');
    const email = typeof emailField === 'string' ? emailField.trim() : '';
    const password = typeof passwordField === 'string' ? passwordField : '';
    if (!email || !password) return { error: 'Email dan kata sandi wajib diisi.' };

    const error = await signIn(email, password);
    if (error) return { error };
    redirect('/');
}

export async function logoutAction(): Promise<void> {
    await signOut();
    redirect('/login');
}
