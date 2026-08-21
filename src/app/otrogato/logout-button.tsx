"use client";

import type { MouseEvent } from "react";
import { useState } from "react";
import { useFormStatus } from "react-dom";

import { getExistingDiferenciasPushSubscription } from "@/lib/diferencias-push-client";

import { deletePushSubscriptionAction } from "./push-actions";

export default function LogoutButton() {
  const { pending } = useFormStatus();
  const [isPreparing, setIsPreparing] = useState(false);

  async function prepareLogout(event: MouseEvent<HTMLButtonElement>) {
    if (pending || isPreparing) {
      event.preventDefault();
      return;
    }

    event.preventDefault();
    setIsPreparing(true);
    const form = event.currentTarget.form;

    try {
      const subscription = await getExistingDiferenciasPushSubscription();

      if (subscription) {
        // Keep the browser permission/subscription itself, but remove its
        // association from the account that is logging out.
        await deletePushSubscriptionAction(subscription.endpoint);
      }
    } catch {
      // The next logged-in account will still safely reassign this endpoint.
    } finally {
      form?.requestSubmit();
      setIsPreparing(false);
    }
  }

  return (
    <button
      className="rounded-full px-4 py-2 text-sm text-[#ff003c] transition hover:bg-[#ff003c]/10 disabled:cursor-not-allowed disabled:text-neutral-500"
      disabled={pending || isPreparing}
      onClick={prepareLogout}
      type="submit"
    >
      {pending || isPreparing ? "logging out..." : "logout"}
    </button>
  );
}
