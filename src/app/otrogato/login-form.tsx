"use client";

import { useActionState } from "react";

import { loginAction, type LoginState } from "./actions";

const initialState: LoginState = { message: "", ok: false };

export default function LoginForm() {
  const [state, formAction, isPending] = useActionState(
    loginAction,
    initialState
  );

  return (
    <main className="min-h-dvh bg-black px-5 py-10 text-white">
      <div className="mx-auto flex min-h-[calc(100dvh-5rem)] w-full max-w-sm flex-col justify-center">
        <div className="rounded-3xl border border-neutral-800 bg-neutral-950/70 p-6">
          <p className="text-xs uppercase tracking-[0.28em] text-neutral-500">
            private
          </p>
          <h1 className="mt-3 text-3xl font-semibold text-white">otrogato</h1>

          <form action={formAction} className="mt-8 space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm text-neutral-400">
                username
              </span>
              <input
                autoCapitalize="none"
                autoComplete="username"
                className="w-full min-w-0 rounded-2xl border border-neutral-800 bg-black px-4 py-3 text-base text-white outline-none transition placeholder:text-neutral-600 focus:border-neutral-500 focus:ring-1 focus:ring-neutral-500/40"
                disabled={isPending}
                maxLength={32}
                name="username"
                required
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm text-neutral-400">
                password
              </span>
              <input
                autoComplete="current-password"
                className="w-full min-w-0 rounded-2xl border border-neutral-800 bg-black px-4 py-3 text-base text-white outline-none transition placeholder:text-neutral-600 focus:border-neutral-500 focus:ring-1 focus:ring-neutral-500/40"
                disabled={isPending}
                maxLength={128}
                name="password"
                required
                type="password"
              />
            </label>

            {state.message ? (
              <p className="text-sm text-red-400">{state.message}</p>
            ) : null}

            <button
              className="w-full rounded-full px-5 py-3 text-sm font-semibold text-[#ff003c] transition hover:bg-[#ff003c]/10 disabled:cursor-not-allowed disabled:text-neutral-500 disabled:hover:bg-transparent"
              disabled={isPending}
              type="submit"
            >
              {isPending ? "entrando" : "log in"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
