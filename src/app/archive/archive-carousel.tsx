"use client";

import Link from "next/link";
import { useRef, useState, type MouseEvent, type TouchEvent } from "react";

type ArchiveCarouselImage = {
  id: string;
  url: string;
};

type ArchiveCarouselProps = {
  description: string;
  href?: string;
  images: ArchiveCarouselImage[];
};

export default function ArchiveCarousel({
  description,
  href,
  images,
}: ArchiveCarouselProps) {
  const [index, setIndex] = useState(0);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const swipeLastRef = useRef<{ x: number; y: number } | null>(null);
  const suppressClickRef = useRef(false);
  const suppressClickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const hasMultipleImages = images.length > 1;
  const currentImage = images[index];

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
              <img
                alt={description || `archive image ${index + 1}`}
                className="h-full w-full object-contain"
                draggable={false}
                src={currentImage.url}
              />
            </Link>
          ) : (
            <img
              alt={description || `archive image ${index + 1}`}
              className="h-full w-full object-contain"
              draggable={false}
              src={currentImage.url}
            />
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
    </div>
  );
}
