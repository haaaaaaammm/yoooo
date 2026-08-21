"use client";

import { useEffect, useRef, useState } from "react";

import {
  getDiferenciasPushCapability,
  getExistingDiferenciasPushSubscription,
  getOrRegisterDiferenciasServiceWorker,
  serializePushSubscription,
  vapidPublicKeyToApplicationServerKey,
} from "@/lib/diferencias-push-client";

import {
  deletePushSubscriptionAction,
  savePushSubscriptionAction,
} from "./push-actions";

type NotificationState =
  | "checking"
  | "denied"
  | "disabled"
  | "enabled"
  | "unavailable";

export default function NotificationSettings({
  vapidPublicKey,
}: {
  vapidPublicKey: string | null;
}) {
  const operationRef = useRef(false);
  const [isPending, setIsPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [state, setState] = useState<NotificationState>("checking");

  useEffect(() => {
    let cancelled = false;

    async function inspectExistingSubscription() {
      const capability = getDiferenciasPushCapability();

      if (!capability.supported) {
        if (!cancelled) {
          setState("unavailable");
        }
        return;
      }

      if (!vapidPublicKey) {
        if (!cancelled) {
          setMessage("Notifications are unavailable right now.");
          setState("unavailable");
        }
        return;
      }

      if (Notification.permission === "denied") {
        if (!cancelled) {
          setState("denied");
        }
        return;
      }

      try {
        const subscription = await getExistingDiferenciasPushSubscription();

        if (!subscription) {
          if (!cancelled) {
            setState("disabled");
          }
          return;
        }

        // Reassign an existing browser endpoint to the currently authenticated
        // account. This makes shared-browser logout/login switching safe.
        const result = await savePushSubscriptionAction(
          serializePushSubscription(subscription)
        );

        if (!cancelled) {
          setMessage(result.ok ? null : result.message);
          setState(result.ok ? "enabled" : "disabled");
        }
      } catch {
        if (!cancelled) {
          setMessage("Could not check this device subscription.");
          setState("disabled");
        }
      }
    }

    void inspectExistingSubscription();

    return () => {
      cancelled = true;
    };
  }, [vapidPublicKey]);

  async function enable() {
    if (operationRef.current || !vapidPublicKey) {
      return;
    }

    operationRef.current = true;
    setIsPending(true);
    setMessage(null);
    let newSubscription: PushSubscription | null = null;

    try {
      const capability = getDiferenciasPushCapability();

      if (!capability.supported) {
        setState("unavailable");
        return;
      }

      const registration = await getOrRegisterDiferenciasServiceWorker();
      const permission =
        Notification.permission === "default"
          ? await Notification.requestPermission()
          : Notification.permission;

      if (permission === "denied") {
        setState("denied");
        return;
      }

      if (permission !== "granted") {
        setMessage("Notification permission was not granted.");
        setState("disabled");
        return;
      }

      const existingSubscription =
        await registration.pushManager.getSubscription();
      newSubscription =
        existingSubscription ??
        (await registration.pushManager.subscribe({
          applicationServerKey:
            vapidPublicKeyToApplicationServerKey(vapidPublicKey),
          userVisibleOnly: true,
        }));
      const result = await savePushSubscriptionAction(
        serializePushSubscription(newSubscription)
      );

      if (!result.ok) {
        if (!existingSubscription) {
          await newSubscription.unsubscribe().catch(() => false);
        }
        setMessage(result.message);
        setState("disabled");
        return;
      }

      setMessage(null);
      setState("enabled");
    } catch {
      setState(Notification.permission === "denied" ? "denied" : "disabled");
      setMessage(
        Notification.permission === "denied"
          ? null
          : "Could not enable notifications on this device."
      );
    } finally {
      operationRef.current = false;
      setIsPending(false);
    }
  }

  async function disable() {
    if (operationRef.current) {
      return;
    }

    operationRef.current = true;
    setIsPending(true);
    setMessage(null);

    try {
      const subscription = await getExistingDiferenciasPushSubscription();

      if (!subscription) {
        setState("disabled");
        return;
      }

      const result = await deletePushSubscriptionAction(subscription.endpoint);

      if (!result.ok) {
        setMessage(result.message);
        return;
      }

      const unsubscribed = await subscription.unsubscribe();

      if (!unsubscribed) {
        setMessage(
          "The account was disconnected, but the browser could not finish unsubscribing. Try again."
        );
        setState("disabled");
        return;
      }

      setMessage(result.message);
      setState("disabled");
    } catch {
      setMessage("Could not disable notifications on this device.");
    } finally {
      operationRef.current = false;
      setIsPending(false);
    }
  }

  if (state === "checking") {
    return null;
  }

  if (state === "unavailable" && !message) {
    return null;
  }

  return (
    <div className="mt-4 border-t border-neutral-900 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-neutral-200">Notifications</p>
          {state === "denied" ? (
            <p className="mt-1 text-sm text-neutral-500">
              Notifications are blocked. You can allow them in your browser or
              device settings.
            </p>
          ) : state === "enabled" ? (
            <p className="mt-1 text-sm text-neutral-500">
              Notifications enabled
            </p>
          ) : message ? (
            <p className="mt-1 text-sm text-neutral-500">{message}</p>
          ) : null}
        </div>

        {state === "enabled" ? (
          <button
            className="rounded-full px-3 py-2 text-sm text-neutral-500 transition hover:bg-[#ff003c]/10 hover:text-[#ff003c] disabled:cursor-not-allowed disabled:text-neutral-700"
            disabled={isPending}
            onClick={() => void disable()}
            type="button"
          >
            {isPending ? "Disabling..." : "Disable notifications"}
          </button>
        ) : state === "disabled" ? (
          <button
            className="rounded-full px-4 py-2 text-sm text-[#ff003c] transition hover:bg-[#ff003c]/10 disabled:cursor-not-allowed disabled:text-neutral-500"
            disabled={isPending}
            onClick={() => void enable()}
            type="button"
          >
            {isPending ? "Enabling..." : "Enable notifications"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
