"use client";

import type { FormEvent } from "react";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import ProfileImage from "@/app/_components/profile-image";

import {
  createDiferenciasAccountAction,
  resetDiferenciasPasswordAction,
  setDiferenciasAccountActiveAction,
  updateDiferenciasAccountAvatarAction,
  updateDiferenciasDisplayNameAction,
} from "./planned-parenthood-actions";

const AVATAR_ACCEPT =
  "image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif";

export type ManagedDiferenciasAccount = {
  avatarUrl: string | null;
  createdAt: string;
  displayName: string;
  id: string;
  isActive: boolean;
  lastLoginAt: string | null;
  lastPostAt: string | null;
  postCount: number;
  username: string;
};

function formatDate(value: string | null) {
  if (!value) {
    return "never";
  }

  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Mexico_City",
  }).format(new Date(value));
}

function AccountCard({ account }: { account: ManagedDiferenciasAccount }) {
  const router = useRouter();
  const pendingRef = useRef(false);
  const [displayName, setDisplayName] = useState(account.displayName);
  const [password, setPassword] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function run(
    operation: () => Promise<{ message: string; ok: boolean }>,
    afterSuccess?: () => void
  ) {
    if (pendingRef.current) {
      return;
    }

    pendingRef.current = true;
    setIsPending(true);
    setMessage(null);

    try {
      const result = await operation();
      setMessage(result.message);

      if (result.ok) {
        afterSuccess?.();
        router.refresh();
      }
    } catch {
      setMessage("No se pudo actualizar la cuenta.");
    } finally {
      pendingRef.current = false;
      setIsPending(false);
    }
  }

  function updateAvatar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    void run(
      () => updateDiferenciasAccountAvatarAction(account.id, formData),
      () => form.reset()
    );
  }

  return (
    <li className="border-b border-neutral-800 px-4 py-5">
      <div className="flex min-w-0 items-start gap-3">
        <ProfileImage
          className="h-12 w-12 flex-none rounded-full object-cover"
          profileImageUrl={account.avatarUrl}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <p className="truncate font-semibold text-white">
              {account.displayName}
            </p>
            <p className="truncate text-sm text-neutral-500">
              @{account.username}
            </p>
            <span
              className={
                account.isActive
                  ? "rounded-full bg-green-500/10 px-2 py-0.5 text-xs text-green-400"
                  : "rounded-full bg-red-500/10 px-2 py-0.5 text-xs text-red-400"
              }
            >
              {account.isActive ? "active" : "disabled"}
            </span>
          </div>
          <dl className="mt-2 grid gap-1 text-xs text-neutral-500 sm:grid-cols-2">
            <div>
              <dt className="inline">created: </dt>
              <dd className="inline">{formatDate(account.createdAt)}</dd>
            </div>
            <div>
              <dt className="inline">posts: </dt>
              <dd className="inline">{account.postCount}</dd>
            </div>
            <div>
              <dt className="inline">last login: </dt>
              <dd className="inline">{formatDate(account.lastLoginAt)}</dd>
            </div>
            <div>
              <dt className="inline">last post: </dt>
              <dd className="inline">{formatDate(account.lastPostAt)}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            void run(() =>
              updateDiferenciasDisplayNameAction(account.id, displayName)
            );
          }}
        >
          <label className="min-w-0 flex-1">
            <span className="sr-only">Display name</span>
            <input
              className="w-full rounded-2xl border border-neutral-800 bg-black px-4 py-2.5 text-base text-white outline-none focus:border-neutral-500"
              disabled={isPending}
              maxLength={100}
              onChange={(event) => setDisplayName(event.target.value)}
              required
              value={displayName}
            />
          </label>
          <button
            className="rounded-full px-4 py-2 text-sm text-[#ff003c] disabled:text-neutral-500"
            disabled={isPending || !displayName.trim()}
            type="submit"
          >
            save name
          </button>
        </form>

        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();

            if (
              !window.confirm(
                `Reset the password for @${account.username} and close all sessions?`
              )
            ) {
              return;
            }

            void run(
              () => resetDiferenciasPasswordAction(account.id, password),
              () => setPassword("")
            );
          }}
        >
          <label className="min-w-0 flex-1">
            <span className="sr-only">New password</span>
            <input
              autoComplete="new-password"
              className="w-full rounded-2xl border border-neutral-800 bg-black px-4 py-2.5 text-base text-white outline-none focus:border-neutral-500"
              disabled={isPending}
              maxLength={128}
              minLength={12}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="new password (12+ characters)"
              required
              type="password"
              value={password}
            />
          </label>
          <button
            className="rounded-full px-4 py-2 text-sm text-[#ff003c] disabled:text-neutral-500"
            disabled={isPending || password.length < 12}
            type="submit"
          >
            reset password
          </button>
        </form>

        <form className="flex flex-col gap-2 sm:flex-row" onSubmit={updateAvatar}>
          <input
            accept={AVATAR_ACCEPT}
            className="block min-w-0 flex-1 overflow-hidden text-sm text-neutral-400 file:mr-3 file:rounded-full file:border-0 file:bg-[#ff003c]/10 file:px-4 file:py-2 file:text-sm file:text-[#ff003c]"
            disabled={isPending}
            name="avatar"
            required
            type="file"
          />
          <button
            className="rounded-full px-4 py-2 text-sm text-[#ff003c] disabled:text-neutral-500"
            disabled={isPending}
            type="submit"
          >
            update avatar
          </button>
        </form>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p
            aria-live="polite"
            className="min-w-0 flex-1 text-sm text-neutral-400"
          >
            {isPending ? "working..." : message}
          </p>
          <button
            className={
              account.isActive
                ? "rounded-full px-4 py-2 text-sm text-red-400 transition hover:bg-red-500/10 disabled:text-neutral-500"
                : "rounded-full px-4 py-2 text-sm text-green-400 transition hover:bg-green-500/10 disabled:text-neutral-500"
            }
            disabled={isPending}
            onClick={() => {
              if (
                account.isActive &&
                !window.confirm(
                  `Deactivate @${account.username} and close all sessions?`
                )
              ) {
                return;
              }

              void run(() =>
                setDiferenciasAccountActiveAction(
                  account.id,
                  !account.isActive
                )
              );
            }}
            type="button"
          >
            {account.isActive ? "deactivate" : "reactivate"}
          </button>
        </div>
      </div>
    </li>
  );
}

export default function PlannedParenthoodManager({
  accounts,
}: {
  accounts: ManagedDiferenciasAccount[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const pendingRef = useRef(false);
  const [isPending, setIsPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function createAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (pendingRef.current) {
      return;
    }

    pendingRef.current = true;
    setIsPending(true);
    setMessage(null);

    try {
      const result = await createDiferenciasAccountAction(
        new FormData(event.currentTarget)
      );
      setMessage(result.message);

      if (result.ok) {
        formRef.current?.reset();
        router.refresh();
      }
    } catch {
      setMessage("No se pudo crear la cuenta.");
    } finally {
      pendingRef.current = false;
      setIsPending(false);
    }
  }

  return (
    <section aria-label="Planned Parenthood accounts">
      <form
        className="space-y-4 border-b border-neutral-800 px-4 py-5"
        onSubmit={createAccount}
        ref={formRef}
      >
        <div>
          <h2 className="font-semibold text-white">create account</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Credentials are only shown here while you enter them.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label>
            <span className="mb-1 block text-sm text-neutral-400">
              display name
            </span>
            <input
              className="w-full rounded-2xl border border-neutral-800 bg-black px-4 py-3 text-base text-white outline-none focus:border-neutral-500"
              disabled={isPending}
              maxLength={100}
              name="displayName"
              required
            />
          </label>
          <label>
            <span className="mb-1 block text-sm text-neutral-400">username</span>
            <input
              autoCapitalize="none"
              autoComplete="off"
              className="w-full rounded-2xl border border-neutral-800 bg-black px-4 py-3 text-base text-white outline-none focus:border-neutral-500"
              disabled={isPending}
              maxLength={32}
              minLength={3}
              name="username"
              pattern="[A-Za-z0-9._-]+"
              required
            />
          </label>
          <label>
            <span className="mb-1 block text-sm text-neutral-400">password</span>
            <input
              autoComplete="new-password"
              className="w-full rounded-2xl border border-neutral-800 bg-black px-4 py-3 text-base text-white outline-none focus:border-neutral-500"
              disabled={isPending}
              maxLength={128}
              minLength={12}
              name="password"
              required
              type="password"
            />
          </label>
          <label>
            <span className="mb-1 block text-sm text-neutral-400">
              avatar (optional)
            </span>
            <input
              accept={AVATAR_ACCEPT}
              className="block w-full min-w-0 overflow-hidden py-2 text-sm text-neutral-400 file:mr-3 file:rounded-full file:border-0 file:bg-[#ff003c]/10 file:px-4 file:py-2 file:text-sm file:text-[#ff003c]"
              disabled={isPending}
              name="avatar"
              type="file"
            />
          </label>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <p aria-live="polite" className="min-w-0 flex-1 text-sm text-neutral-400">
            {message}
          </p>
          <button
            className="rounded-full px-5 py-2.5 text-sm font-semibold text-[#ff003c] transition hover:bg-[#ff003c]/10 disabled:text-neutral-500"
            disabled={isPending}
            type="submit"
          >
            {isPending ? "creating..." : "create account"}
          </button>
        </div>
      </form>

      {accounts.length === 0 ? (
        <p className="border-b border-neutral-800 px-4 py-10 text-center text-sm text-neutral-500">
          no accounts yet
        </p>
      ) : (
        <ol>
          {accounts.map((account) => (
            <AccountCard account={account} key={account.id} />
          ))}
        </ol>
      )}
    </section>
  );
}
