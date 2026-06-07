"use client";

import { useState } from "react";

type ArchiveCarouselImage = {
  id: string;
  url: string;
};

type ArchiveCarouselProps = {
  description: string;
  images: ArchiveCarouselImage[];
};

export default function ArchiveCarousel({
  description,
  images,
}: ArchiveCarouselProps) {
  const [index, setIndex] = useState(0);
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

  return (
    <div className="mt-3">
      <div className="relative overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950">
        <div className="aspect-[4/5] w-full">
          <img
            alt={description || `archive image ${index + 1}`}
            className="h-full w-full object-contain"
            src={currentImage.url}
          />
        </div>

        {hasMultipleImages ? (
          <>
            <button
              aria-label="Previous image"
              className="absolute left-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/70 text-sm text-[#ff003c] transition hover:bg-[#ff003c]/10"
              onClick={showPrevious}
              type="button"
            >
              &lt;
            </button>
            <button
              aria-label="Next image"
              className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/70 text-sm text-[#ff003c] transition hover:bg-[#ff003c]/10"
              onClick={showNext}
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
              onClick={() => setIndex(dotIndex)}
              type="button"
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
