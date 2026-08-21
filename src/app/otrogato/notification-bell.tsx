"use client";

import { Bell, BellOff } from "lucide-react";
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

export default function NotificationBell({
  vapidPublicKey,
}: {
  vapidPublicKey: string | null;
}) {
  const operationRef = useRef(false);
  const [isPending, setIsPending] = useState(false);
  const [state, setState] = useState<NotificationState>("checking");

  useEffect(() => {
    let cancelled = false;

    async function inspectExistingSubscription() {
      if (!getDiferenciasPushCapability().supported || !vapidPublicKey) {
        if (!cancelled) {
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

        // Keep an existing browser endpoint associated with whichever account
        // is currently authenticated in this browser profile.
        const result = await savePushSubscriptionAction(
          serializePushSubscription(subscription)
        );

        if (!cancelled) {
          setState(result.ok ? "enabled" : "disabled");
        }
      } catch {
        if (!cancelled) {
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

    try {
      if (!getDiferenciasPushCapability().supported) {
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
        window.alert("Notification permission was not granted.");
        setState("disabled");
        return;
      }

      const existingSubscription =
        await registration.pushManager.getSubscription();
      const subscription =
        existingSubscription ??
        (await registration.pushManager.subscribe({
          applicationServerKey:
            vapidPublicKeyToApplicationServerKey(vapidPublicKey),
          userVisibleOnly: true,
        }));
      const result = await savePushSubscriptionAction(
        serializePushSubscription(subscription)
      );

      if (!result.ok) {
        if (!existingSubscription) {
          await subscription.unsubscribe().catch(() => false);
        }

        window.alert(result.message);
        setState("disabled");
        return;
      }

      setState("enabled");
    } catch {
      if (Notification.permission === "denied") {
        setState("denied");
      } else {
        window.alert("Could not enable notifications on this device.");
        setState("disabled");
      }
    } finally {
      operationRef.current = false;
      setIsPending(false);
    }
  }

  async function disable() {
    if (
      operationRef.current ||
      !window.confirm("Disable notifications on this device?")
    ) {
      return;
    }

    operationRef.current = true;
    setIsPending(true);

    try {
      const subscription = await getExistingDiferenciasPushSubscription();

      if (!subscription) {
        setState("disabled");
        return;
      }

      const result = await deletePushSubscriptionAction(subscription.endpoint);

      if (!result.ok) {
        window.alert(result.message);
        return;
      }

      const unsubscribed = await subscription.unsubscribe();

      if (!unsubscribed) {
        window.alert(
          "This device was disconnected, but the browser could not finish unsubscribing."
        );
      }

      setState("disabled");
    } catch {
      window.alert("Could not disable notifications on this device.");
    } finally {
      operationRef.current = false;
      setIsPending(false);
    }
  }

  if (state === "checking" || state === "unavailable") {
    return null;
  }

  const isBlocked = state === "denied";
  const isEnabled = state === "enabled";
  const label = isBlocked
    ? "Notifications blocked by browser"
    : isEnabled
      ? "Disable notifications"
      : "Enable notifications";

  return (
    <button
      aria-label={label}
      aria-pressed={isBlocked ? undefined : isEnabled}
      className={`flex h-10 w-10 flex-none items-center justify-center rounded-full transition hover:bg-[#ff003c]/10 disabled:cursor-not-allowed disabled:hover:bg-transparent ${
        isBlocked
          ? "text-neutral-600"
          : isPending
            ? "animate-pulse text-[#ff003c]/60"
            : "text-[#ff003c]"
      }`}
      disabled={isBlocked || isPending}
      onClick={() => void (isEnabled ? disable() : enable())}
      title={label}
      type="button"
    >
      {isBlocked ? (
        <BellOff aria-hidden="true" size={19} strokeWidth={1.8} />
      ) : (
        <Bell
          aria-hidden="true"
          fill={isEnabled ? "currentColor" : "none"}
          size={19}
          strokeWidth={isEnabled ? 2 : 1.8}
        />
      )}
    </button>
  );
}
