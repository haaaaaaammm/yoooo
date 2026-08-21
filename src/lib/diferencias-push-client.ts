export type DiferenciasPushCapability =
  | { supported: true }
  | {
      reason: "apple_requires_standalone" | "insecure" | "unsupported";
      supported: false;
    };

type AppleNavigator = Navigator & { standalone?: boolean };

export function getDiferenciasPushCapability(): DiferenciasPushCapability {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return { reason: "unsupported", supported: false };
  }

  if (!window.isSecureContext) {
    return { reason: "insecure", supported: false };
  }

  const hasRequiredApis =
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;

  if (!hasRequiredApis) {
    return { reason: "unsupported", supported: false };
  }

  const appleNavigator = navigator as AppleNavigator;
  const isTouchMac =
    navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  const isAppleMobile = /iPad|iPhone|iPod/.test(navigator.userAgent) || isTouchMac;
  const isStandalone =
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    appleNavigator.standalone === true;

  if (isAppleMobile && !isStandalone) {
    return { reason: "apple_requires_standalone", supported: false };
  }

  return { supported: true };
}

export function vapidPublicKeyToApplicationServerKey(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = `${value}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const decoded = window.atob(base64);
  const bytes = new Uint8Array(decoded.length);

  for (let index = 0; index < decoded.length; index += 1) {
    bytes[index] = decoded.charCodeAt(index);
  }

  return bytes;
}

export function serializePushSubscription(subscription: PushSubscription) {
  const json = subscription.toJSON();

  return {
    auth: json.keys?.auth ?? "",
    endpoint: subscription.endpoint,
    p256dh: json.keys?.p256dh ?? "",
  };
}

export async function getExistingDiferenciasPushSubscription() {
  const registration = await navigator.serviceWorker.getRegistration("/");
  return registration?.pushManager.getSubscription() ?? null;
}

export async function getOrRegisterDiferenciasServiceWorker() {
  await navigator.serviceWorker.register("/sw.js", {
    scope: "/",
    updateViaCache: "none",
  });

  return navigator.serviceWorker.ready;
}
