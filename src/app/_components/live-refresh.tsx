"use client";

import { useCallback, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";

const DEFAULT_INTERVAL_MS = 5_000;
const RETURN_EVENT_DEBOUNCE_MS = 750;

export default function LiveRefresh({
  intervalMs = DEFAULT_INTERVAL_MS,
}: {
  intervalMs?: number;
}) {
  const router = useRouter();
  const [isRefreshPending, startTransition] = useTransition();
  const inFlightRef = useRef(false);
  const lastRefreshAtRef = useRef(0);
  const releaseGuardRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sawPendingTransitionRef = useRef(false);

  useEffect(() => {
    if (isRefreshPending) {
      sawPendingTransitionRef.current = true;
      return;
    }

    if (sawPendingTransitionRef.current) {
      sawPendingTransitionRef.current = false;
      inFlightRef.current = false;

      if (releaseGuardRef.current) {
        clearTimeout(releaseGuardRef.current);
        releaseGuardRef.current = null;
      }
    }
  }, [isRefreshPending]);

  const refresh = useCallback(() => {
    if (
      document.visibilityState !== "visible" ||
      inFlightRef.current ||
      Date.now() - lastRefreshAtRef.current < RETURN_EVENT_DEBOUNCE_MS
    ) {
      return;
    }

    inFlightRef.current = true;
    lastRefreshAtRef.current = Date.now();

    try {
      startTransition(() => {
        router.refresh();
      });
    } finally {
      // router.refresh() does not return a promise. React's transition state
      // releases the guard after the refreshed server payload settles; this
      // fallback covers refreshes that complete without a pending render.
      releaseGuardRef.current = setTimeout(() => {
        if (!sawPendingTransitionRef.current) {
          inFlightRef.current = false;
        }
        releaseGuardRef.current = null;
      }, Math.max(250, intervalMs - 250));
    }
  }, [intervalMs, router, startTransition]);

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;

    function stopPolling() {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    }

    function startPolling() {
      stopPolling();

      if (document.visibilityState === "visible") {
        intervalId = setInterval(refresh, intervalMs);
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        refresh();
        startPolling();
      } else {
        stopPolling();
      }
    }

    function handleFocus() {
      if (document.visibilityState === "visible") {
        refresh();
        startPolling();
      }
    }

    startPolling();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);

    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);

      if (releaseGuardRef.current) {
        clearTimeout(releaseGuardRef.current);
        releaseGuardRef.current = null;
      }

      inFlightRef.current = false;
    };
  }, [intervalMs, refresh]);

  return null;
}
