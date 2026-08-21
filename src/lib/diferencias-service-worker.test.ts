import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

type WorkerEvent = { waitUntil: (promise: Promise<unknown>) => void };
type WorkerListener = (event: WorkerEvent & Record<string, unknown>) => void;

function createWorkerHarness() {
  const listeners = new Map<string, WorkerListener>();
  const showNotification = vi.fn(async () => undefined);
  const navigate = vi.fn(async () => appWindow);
  const focus = vi.fn(async () => appWindow);
  const appWindow = {
    focus,
    navigate,
    url: "https://example.test/otrogato",
  };
  const openWindow = vi.fn(async () => appWindow);
  const source = readFileSync(
    new URL("../../public/sw.js", import.meta.url),
    "utf8"
  );

  runInNewContext(source, {
    URL,
    clients: {
      matchAll: vi.fn(async () => [appWindow]),
      openWindow,
    },
    self: {
      addEventListener(type: string, listener: WorkerListener) {
        listeners.set(type, listener);
      },
      location: { origin: "https://example.test" },
      registration: { showNotification },
    },
  });

  return { appWindow, listeners, navigate, openWindow, showNotification };
}

async function runEvent(listener: WorkerListener, event: Record<string, unknown>) {
  let completion: Promise<unknown> | null = null;

  listener({
    ...event,
    waitUntil(promise: Promise<unknown>) {
      completion = promise;
    },
  });

  await completion;
}

describe("Otrogato push service worker", () => {
  it("shows a push with the existing Otrogato icon and an internal target", async () => {
    const { listeners, showNotification } = createWorkerHarness();
    const listener = listeners.get("push");
    expect(listener).toBeDefined();

    await runEvent(listener!, {
      data: {
        json: () => ({
          body: "hello",
          title: "Walter posted",
          url: "/otrogato/post-1#comment-1",
        }),
      },
    });

    expect(showNotification).toHaveBeenCalledWith("Walter posted", {
      body: "hello",
      data: { url: "/otrogato/post-1#comment-1" },
      icon: "/icons/otrogato-192.png",
    });
  });

  it("rejects an external notification URL and reuses the Otrogato window", async () => {
    const { appWindow, listeners, navigate, openWindow } = createWorkerHarness();
    const listener = listeners.get("notificationclick");
    expect(listener).toBeDefined();

    await runEvent(listener!, {
      notification: {
        close: vi.fn(),
        data: { url: "https://evil.example/steal" },
      },
    });

    expect(navigate).toHaveBeenCalledWith("https://example.test/otrogato");
    expect(appWindow.focus).toHaveBeenCalledOnce();
    expect(openWindow).not.toHaveBeenCalled();
  });
});
