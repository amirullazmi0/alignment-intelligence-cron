'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import { loginAction, type LoginState } from '@/app/login/actions';

const INITIAL: LoginState = { error: '' };

function SubmitButton() {
    // Status diambil dari form induk, jadi tombol tahu aksinya sedang berjalan tanpa
    // perlu state tambahan yang bisa keluar dari sinkron.
    const { pending } = useFormStatus();
    return (
        <button type="submit" disabled={pending} className="btn btn-primary btn-sm w-full">
            {pending && <span className="loading loading-spinner loading-xs" />}
            Masuk
        </button>
    );
}

export default function LoginForm() {
    const [state, action] = useActionState(loginAction, INITIAL);

    return (
        <form action={action} className="space-y-3">
            {state.error && (
                <div className="alert alert-error py-2 text-sm">
                    <span>{state.error}</span>
                </div>
            )}

            <label className="form-control w-full">
                <span className="mb-1 text-sm font-medium">Email</span>
                <input
                    name="email"
                    type="email"
                    autoComplete="username"
                    required
                    className="input input-bordered w-full"
                />
            </label>

            <label className="form-control w-full">
                <span className="mb-1 text-sm font-medium">Kata sandi</span>
                <input
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    className="input input-bordered w-full"
                />
            </label>

            <SubmitButton />
        </form>
    );
}
