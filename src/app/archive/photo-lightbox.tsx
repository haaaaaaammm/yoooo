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

function getImageKey(image: LightboxImage, index: number) {
  return image.id || image.url || String(index);
}

function getLoadedImageKey(image: LightboxImage) {
  return image.url || image.id;
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
  const [loadedImages, setLoadedImages] = useState<Record<string, boolean>>({});
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const currentImage = index === null ? undefined : images[index];
  const currentImageKey =
    currentImage && index !== null ? getImageKey(currentImage, index) : "";
  const currentLoadedImageKey = currentImage
    ? getLoadedImageKey(currentImage)
    : "";
  const isCurrentImageLoaded =
    currentLoadedImageKey !== "" && loadedImages[currentLoadedImageKey] === true;

  const markImageLoaded = useCallback((imageKey: string) => {
    setLoadedImages((current) =>
      current[imageKey] ? current : { ...current, [imageKey]: true }
    );
  }, []);

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

      const loadedImageKey = getLoadedImageKey(image);

      if (loadedImages[loadedImageKey]) {
        return;
      }

      const preload = new window.Image();

      preload.onload = () => markImageLoaded(loadedImageKey);
      preload.onerror = () => markImageLoaded(loadedImageKey);
      preload.src = image.url;
      preloadedImages.push(preload);
    });

    return () => {
      preloadedImages.forEach((preload) => {
        preload.onload = null;
        preload.onerror = null;
      });
    };
  }, [images, index, loadedImages, markImageLoaded, total]);

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

        {!isCurrentImageLoaded ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-neutral-500">
            cargando
          </div>
        ) : null}

        <img
          alt={alt ? alt(index) : `foto ${index + 1}`}
          className={`max-h-full max-w-full object-contain ${
            isCurrentImageLoaded ? "opacity-100" : "opacity-0"
          }`}
          key={currentImageKey}
          onClick={(event) => event.stopPropagation()}
          onError={() => markImageLoaded(currentLoadedImageKey)}
          onLoad={() => markImageLoaded(currentLoadedImageKey)}
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
