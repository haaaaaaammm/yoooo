"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type TouchEvent,
} from "react";

import PhotoLightbox from "./photo-lightbox";

type ArchiveCarouselImage = {
  id: string;
  url: string;
};

type ArchiveCarouselProps = {
  description: string;
  enableLightbox?: boolean;
  href?: string;
  images: ArchiveCarouselImage[];
};

function getImageKey(image: ArchiveCarouselImage, index: number) {
  return image.id || image.url || String(index);
}

function getLoadedImageKey(image: ArchiveCarouselImage) {
  return image.url || image.id;
}

export default function ArchiveCarousel({
  description,
  enableLightbox = false,
  href,
  images,
}: ArchiveCarouselProps) {
  const [index, setIndex] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [loadedImages, setLoadedImages] = useState<Record<string, boolean>>({});
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const swipeLastRef = useRef<{ x: number; y: number } | null>(null);
  const suppressClickRef = useRef(false);
  const suppressClickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const hasMultipleImages = images.length > 1;
  const currentImage = images[index];
  const currentImageKey = currentImage ? getImageKey(currentImage, index) : "";
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

  useEffect(() => {
    if (!hasMultipleImages || typeof window === "undefined") {
      return;
    }

    const adjacentIndexes = new Set([
      (index - 1 + images.length) % images.length,
      (index + 1) % images.length,
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
  }, [hasMultipleImages, images, index, loadedImages, markImageLoaded]);

  if (!currentImage) {
    return null;
  }

  function showPrevious() {
    setIndex((current) => (current === 0 ? images.length - 1 : current - 1));
  }

  function showNext() {
    setIndex((current) => (current + 1) % images.length);
  }

  function keepSwipeFromOpeningLink() {
    suppressClickRef.current = true;

    if (suppressClickTimeoutRef.current) {
      clearTimeout(suppressClickTimeoutRef.current);
    }

    suppressClickTimeoutRef.current = setTimeout(() => {
      suppressClickRef.current = false;
    }, 400);
  }

  function handleTouchStart(event: TouchEvent<HTMLDivElement>) {
    if (!hasMultipleImages) {
      return;
    }

    const touch = event.touches[0];

    swipeStartRef.current = { x: touch.clientX, y: touch.clientY };
    swipeLastRef.current = { x: touch.clientX, y: touch.clientY };
  }

  function handleTouchMove(event: TouchEvent<HTMLDivElement>) {
    if (!hasMultipleImages || !swipeStartRef.current) {
      return;
    }

    const touch = event.touches[0];
    const deltaX = touch.clientX - swipeStartRef.current.x;
    const deltaY = touch.clientY - swipeStartRef.current.y;

    swipeLastRef.current = { x: touch.clientX, y: touch.clientY };

    if (Math.abs(deltaX) > 12 && Math.abs(deltaX) > Math.abs(deltaY) * 1.15) {
      if (event.cancelable) {
        event.preventDefault();
      }
    }
  }

  function handleTouchEnd() {
    if (!hasMultipleImages || !swipeStartRef.current || !swipeLastRef.current) {
      swipeStartRef.current = null;
      swipeLastRef.current = null;
      return;
    }

    const deltaX = swipeLastRef.current.x - swipeStartRef.current.x;
    const deltaY = swipeLastRef.current.y - swipeStartRef.current.y;
    const isHorizontalSwipe =
      Math.abs(deltaX) > 45 && Math.abs(deltaX) > Math.abs(deltaY) * 1.35;

    if (isHorizontalSwipe) {
      if (deltaX < 0) {
        showNext();
      } else {
        showPrevious();
      }

      keepSwipeFromOpeningLink();
    }

    swipeStartRef.current = null;
    swipeLastRef.current = null;
  }

  function handleLinkClick(event: MouseEvent<HTMLAnchorElement>) {
    if (!suppressClickRef.current) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
  }

  function openLightbox() {
    // A swipe just changed the image; don't also open the viewer on that tap.
    if (suppressClickRef.current) {
      return;
    }

    setLightboxIndex(index);
  }

  function renderCurrentImage() {
    const imageAlt = description || `archive image ${index + 1}`;

    return (
      <span className="relative block h-full w-full">
        {!isCurrentImageLoaded ? (
          <span className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-neutral-950 text-sm text-neutral-500">
            cargando
          </span>
        ) : null}
        <img
          alt={imageAlt}
          className={`h-full w-full object-contain ${
            isCurrentImageLoaded ? "opacity-100" : "opacity-0"
          }`}
          draggable={false}
          key={currentImageKey}
          onError={() => markImageLoaded(currentLoadedImageKey)}
          onLoad={() => markImageLoaded(currentLoadedImageKey)}
          src={currentImage.url}
        />
      </span>
    );
  }

  return (
    <div className="mt-3">
      <div className="relative overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950">
        <div
          className="aspect-[4/5] w-full select-none [touch-action:pan-y]"
          onTouchEnd={handleTouchEnd}
          onTouchMove={handleTouchMove}
          onTouchStart={handleTouchStart}
        >
          {href ? (
            <Link
              aria-label="Open archive post"
              className="block h-full w-full"
              href={href}
              onClick={handleLinkClick}
            >
              {renderCurrentImage()}
            </Link>
          ) : enableLightbox ? (
            <button
              aria-label="Ver foto en grande"
              className="block h-full w-full cursor-pointer focus:outline-none focus-visible:bg-[#ff003c]/10"
              onClick={openLightbox}
              type="button"
            >
              {renderCurrentImage()}
            </button>
          ) : (
            renderCurrentImage()
          )}
        </div>

        {hasMultipleImages ? (
          <>
            <button
              aria-label="Previous image"
              className="absolute left-3 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/70 text-sm text-[#ff003c] transition hover:bg-[#ff003c]/10"
              onClick={(event) => {
                event.stopPropagation();
                showPrevious();
              }}
              type="button"
            >
              &lt;
            </button>
            <button
              aria-label="Next image"
              className="absolute right-3 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/70 text-sm text-[#ff003c] transition hover:bg-[#ff003c]/10"
              onClick={(event) => {
                event.stopPropagation();
                showNext();
              }}
              type="button"
            >
              &gt;
            </button>
          </>
        ) : null}
      </div>

      {hasMultipleImages ? (
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {images.map((image, dotIndex) => (
            <button
              aria-label={`Show image ${dotIndex + 1}`}
              className={
                dotIndex === index
                  ? "h-1.5 w-5 rounded-full bg-[#ff003c]"
                  : "h-1.5 w-1.5 rounded-full bg-neutral-700 transition hover:bg-[#ff003c]/60"
              }
              key={image.id}
              onClick={(event) => {
                event.stopPropagation();
                setIndex(dotIndex);
              }}
              type="button"
            />
          ))}
        </div>
      ) : null}

      {enableLightbox ? (
        <PhotoLightbox
          alt={(currentIndex) =>
            description || `archive image ${currentIndex + 1}`
          }
          images={images}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={(nextIndex) => {
            setLightboxIndex(nextIndex);
            setIndex(nextIndex);
          }}
        />
      ) : null}
    </div>
  );
}
