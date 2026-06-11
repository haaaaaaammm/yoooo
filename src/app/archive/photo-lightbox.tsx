"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type TouchEvent,
} from "react";

export type LightboxImage = {
  id: string;
  url: string;
};

type PhotoLightboxProps = {
  alt?: (index: number) => string;
  images: LightboxImage[];
  index: number | null;
  onClose: () => void;
  onNavigate: (nextIndex: number) => void;
};

const controlClassName =
  "flex h-10 w-10 items-center justify-center rounded-full border border-neutral-800 bg-black/70 text-lg leading-none text-[#ff003c] transition hover:bg-[#ff003c]/10 hover:text-[#ff4d75] focus:outline-none focus-visible:border-neutral-500 focus-visible:bg-[#ff003c]/10";
const counterClassName =
  "rounded-full border border-neutral-800 bg-black/70 px-3 py-2 text-sm tabular-nums text-neutral-500";
const retryButtonClassName =
  "rounded-full border border-neutral-800 bg-black/70 px-4 py-2 text-sm text-[#ff003c] transition hover:bg-[#ff003c]/10 hover:text-[#ff4d75] focus:outline-none focus-visible:border-neutral-500 focus-visible:bg-[#ff003c]/10";

// Loading is tracked per image so navigation never waits on (or is blocked by)
// another image's load, and a slow/broken image can't trap the viewer.
type ImageStatus = "loading" | "loaded" | "error";

// Safety net: if neither onLoad nor onError fires (stalled request), fall back
// to the error/retry state instead of spinning forever.
const IMAGE_LOAD_TIMEOUT_MS = 12000;

function getImageKey(image: LightboxImage, index: number) {
  return image.id || image.url || String(index);
}

export default function PhotoLightbox({
  alt,
  images,
  index,
  onClose,
  onNavigate,
}: PhotoLightboxProps) {
  const isOpen = index !== null;
  const total = images.length;
  const [imageStatus, setImageStatus] = useState<Record<string, ImageStatus>>(
    {}
  );
  const [attempt, setAttempt] = useState<Record<string, number>>({});
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const currentImage = index === null ? undefined : images[index];
  const currentImageKey =
    currentImage && index !== null ? getImageKey(currentImage, index) : "";
  // Always derive what to show from the active image. An unseen image defaults
  // to "loading"; we never fall back to a previously shown photo.
  const activeStatus: ImageStatus = currentImageKey
    ? imageStatus[currentImageKey] ?? "loading"
    : "loading";
  // The remount key changes on retry so the browser re-requests a failed image.
  const renderKey = currentImageKey
    ? `${currentImageKey}#${attempt[currentImageKey] ?? 0}`
    : "";

  const markImageStatus = useCallback(
    (imageKey: string, status: ImageStatus) => {
      if (!imageKey) {
        return;
      }

      setImageStatus((current) => {
        const existing = current[imageKey];

        if (existing === status) {
          return current;
        }

        // A loaded image stays loaded so navigating back to it never flickers.
        if (existing === "loaded" && status === "loading") {
          return current;
        }

        return { ...current, [imageKey]: status };
      });
    },
    []
  );

  const retryImage = useCallback(
    (imageKey: string) => {
      if (!imageKey) {
        return;
      }

      setAttempt((current) => ({
        ...current,
        [imageKey]: (current[imageKey] ?? 0) + 1,
      }));
      markImageStatus(imageKey, "loading");
    },
    [markImageStatus]
  );

  const goPrev = useCallback(() => {
    if (index === null || total <= 1) {
      return;
    }

    onNavigate((index - 1 + total) % total);
  }, [index, onNavigate, total]);

  const goNext = useCallback(() => {
    if (index === null || total <= 1) {
      return;
    }

    onNavigate((index + 1) % total);
  }, [index, onNavigate, total]);

  useEffect(() => {
    if (index === null || total <= 1 || typeof window === "undefined") {
      return;
    }

    const adjacentIndexes = new Set([
      (index - 1 + total) % total,
      (index + 1) % total,
    ]);
    const preloadedImages: HTMLImageElement[] = [];

    adjacentIndexes.forEach((adjacentIndex) => {
      const image = images[adjacentIndex];

      if (!image) {
        return;
      }

      const imageKey = getImageKey(image, adjacentIndex);

      if (imageStatus[imageKey] === "loaded") {
        return;
      }

      const preload = new window.Image();

      // Only promote to "loaded" on success; a preload failure is left for the
      // visible <img> (and its timeout) to confirm, so we never error early.
      preload.onload = () => markImageStatus(imageKey, "loaded");
      preload.src = image.url;
      preloadedImages.push(preload);
    });

    return () => {
      preloadedImages.forEach((preload) => {
        preload.onload = null;
        preload.onerror = null;
      });
    };
  }, [images, index, imageStatus, markImageStatus, total]);

  // Per-image safety timeout: if the active image never reports load or error
  // (stalled request), surface the error/retry state instead of an endless
  // spinner. Resets whenever the active image changes or leaves "loading".
  useEffect(() => {
    if (
      !currentImageKey ||
      activeStatus !== "loading" ||
      typeof window === "undefined"
    ) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      markImageStatus(currentImageKey, "error");
    }, IMAGE_LOAD_TIMEOUT_MS);

    return () => window.clearTimeout(timeoutId);
  }, [activeStatus, currentImageKey, markImageStatus, renderKey]);

  // Esc closes, arrow keys navigate — only while the viewer is open.
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      } else if (event.key === "ArrowLeft") {
        goPrev();
      } else if (event.key === "ArrowRight") {
        goNext();
      } else if (event.key === "Tab") {
        // Keep keyboard focus inside the dialog while it is open.
        const focusable =
          dialogRef.current?.querySelectorAll<HTMLElement>("button");

        if (!focusable || focusable.length === 0) {
          return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goNext, goPrev, isOpen, onClose]);

  // Lock background scroll while open, compensating for the scrollbar width so
  // the page underneath does not shift when the viewer opens/closes.
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const { body, documentElement } = document;
    const scrollbarWidth = window.innerWidth - documentElement.clientWidth;
    const previousOverflow = body.style.overflow;
    const previousPaddingRight = body.style.paddingRight;

    body.style.overflow = "hidden";

    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPaddingRight;
    };
  }, [isOpen]);

  // Move focus into the dialog on open and restore it to the element that
  // opened the viewer on close.
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previouslyFocused = document.activeElement as HTMLElement | null;

    closeButtonRef.current?.focus();

    return () => {
      previouslyFocused?.focus?.();
    };
  }, [isOpen]);

  if (index === null) {
    return null;
  }

  if (!currentImage) {
    return null;
  }

  const hasMultiple = total > 1;

  function handleTouchStart(event: TouchEvent<HTMLDivElement>) {
    const touch = event.touches[0];

    swipeStartRef.current = { x: touch.clientX, y: touch.clientY };
  }

  function handleTouchEnd(event: TouchEvent<HTMLDivElement>) {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;

    if (!start || !hasMultiple) {
      return;
    }

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;

    if (Math.abs(deltaX) > 45 && Math.abs(deltaX) > Math.abs(deltaY) * 1.35) {
      if (deltaX < 0) {
        goNext();
      } else {
        goPrev();
      }
    }
  }

  return (
    <div
      aria-label="Visor de fotos"
      aria-modal="true"
      className="fixed inset-0 z-50 flex flex-col bg-black/90 backdrop-blur-sm"
      onClick={onClose}
      ref={dialogRef}
      role="dialog"
    >
      <div className="flex flex-none items-center justify-between gap-3 px-4 py-3">
        <span className={counterClassName}>
          {index + 1} / {total}
        </span>
        <button
          aria-label="Cerrar"
          className={controlClassName}
          onClick={(event) => {
            event.stopPropagation();
            onClose();
          }}
          ref={closeButtonRef}
          type="button"
        >
          {"×"}
        </button>
      </div>

      <div
        className="relative flex min-h-0 flex-1 items-center justify-center px-2 pb-4 [touch-action:pan-y]"
        onTouchEnd={handleTouchEnd}
        onTouchStart={handleTouchStart}
      >
        {hasMultiple ? (
          <button
            aria-label="Foto anterior"
            className={`absolute left-2 top-1/2 z-10 -translate-y-1/2 ${controlClassName}`}
            onClick={(event) => {
              event.stopPropagation();
              goPrev();
            }}
            type="button"
          >
            {"<"}
          </button>
        ) : null}

        {activeStatus === "loading" ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-neutral-500">
            cargando
          </div>
        ) : null}

        {activeStatus === "error" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center text-sm text-neutral-500">
            <span>no se pudo cargar la foto</span>
            <button
              className={retryButtonClassName}
              onClick={(event) => {
                event.stopPropagation();
                retryImage(currentImageKey);
              }}
              type="button"
            >
              reintentar
            </button>
          </div>
        ) : null}

        <img
          alt={alt ? alt(index) : `foto ${index + 1}`}
          className={`max-h-full max-w-full object-contain ${
            activeStatus === "loaded" ? "opacity-100" : "opacity-0"
          }`}
          key={renderKey}
          onClick={(event) => event.stopPropagation()}
          onError={() => markImageStatus(currentImageKey, "error")}
          onLoad={() => markImageStatus(currentImageKey, "loaded")}
          src={currentImage.url}
        />

        {hasMultiple ? (
          <button
            aria-label="Foto siguiente"
            className={`absolute right-2 top-1/2 z-10 -translate-y-1/2 ${controlClassName}`}
            onClick={(event) => {
              event.stopPropagation();
              goNext();
            }}
            type="button"
          >
            {">"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
