"use client";

import { useState } from "react";

import PhotoLightbox, { type LightboxImage } from "../../photo-lightbox";

type AlbumPhotoGridProps = {
  images: LightboxImage[];
  title: string;
};

export default function AlbumPhotoGrid({ images, title }: AlbumPhotoGridProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <>
      <div className="mt-5 grid grid-cols-3 gap-1.5 sm:grid-cols-4 sm:gap-2">
        {images.map((image, index) => (
          <button
            aria-label={`Ver foto ${index + 1} de ${title}`}
            className="group block overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950 transition focus:outline-none focus-visible:border-neutral-500 focus-visible:bg-[#ff003c]/10"
            key={image.id}
            onClick={() => setOpenIndex(index)}
            type="button"
          >
            <img
              alt={`${title} ${index + 1}`}
              className="aspect-square h-full w-full cursor-pointer object-cover transition duration-300 group-hover:opacity-90"
              loading={index < 12 ? "eager" : "lazy"}
              src={image.url}
            />
          </button>
        ))}
      </div>

      <PhotoLightbox
        alt={(currentIndex) => `${title} ${currentIndex + 1}`}
        images={images}
        index={openIndex}
        onClose={() => setOpenIndex(null)}
        onNavigate={setOpenIndex}
      />
    </>
  );
}
