"use client";

import Link from "next/link";
import { useState } from "react";

import LinkifiedText from "@/app/_components/linkified-text";

import ArchiveCardMenu from "./archive-card-menu";
import PhotoLightbox, { type LightboxImage } from "./photo-lightbox";

type ArchiveAlbumCardProps = {
  coverImage: LightboxImage | null;
  description: string;
  href: string;
  imageCount: number;
  previewImages: LightboxImage[];
  takenAtIso: string;
  takenAtLabel: string;
  title: string | null;
};

// The clickable images are the card's preview set only (cover + up to 3
// thumbnails), so lightbox navigation is scoped to what the card shows — never
// the full album.
export default function ArchiveAlbumCard({
  coverImage,
  description,
  href,
  imageCount,
  previewImages,
  takenAtIso,
  takenAtLabel,
  title,
}: ArchiveAlbumCardProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const albumTitle = title ?? "album";
  const lightboxImages = coverImage ? [coverImage, ...previewImages] : [];

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <time
          className="text-sm leading-5 text-neutral-500"
          dateTime={takenAtIso}
        >
          {takenAtLabel}
        </time>
        <div className="flex flex-none items-center gap-1">
          <span className="text-sm text-neutral-500">album</span>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-[1fr_5.5rem] gap-2 sm:grid-cols-[1fr_7rem]">
        {coverImage ? (
          <button
            aria-label={`Ver fotos de ${albumTitle}`}
            className="group relative block overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950 focus:outline-none focus-visible:border-neutral-500 focus-visible:bg-[#ff003c]/10"
            onClick={() => setOpenIndex(0)}
            type="button"
          >
            <img
              alt={albumTitle}
              className="aspect-[4/5] w-full cursor-pointer object-cover transition duration-300 group-hover:scale-[1.01]"
              loading="lazy"
              src={coverImage.url}
            />
            <span className="pointer-events-none absolute bottom-2 right-2 rounded-full bg-black/75 px-2 py-1 text-xs text-neutral-200">
              {imageCount} foto{imageCount === 1 ? "" : "s"}
            </span>
          </button>
        ) : (
          <div className="relative overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950">
            <div className="aspect-[4/5]" />
          </div>
        )}

        <div className="grid grid-rows-3 gap-2">
          {previewImages.length > 0
            ? previewImages.map((image, index) => (
                <button
                  aria-label={`Ver foto ${index + 2} de ${albumTitle}`}
                  className="group block overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950 focus:outline-none focus-visible:border-neutral-500 focus-visible:bg-[#ff003c]/10"
                  key={image.id}
                  onClick={() => setOpenIndex(index + 1)}
                  type="button"
                >
                  <img
                    alt={`${albumTitle} preview ${index + 1}`}
                    className="aspect-square h-full w-full cursor-pointer object-cover transition duration-300 group-hover:opacity-90"
                    loading="lazy"
                    src={image.url}
                  />
                </button>
              ))
            : [0, 1, 2].map((index) => (
                <div
                  className="rounded-xl border border-neutral-900 bg-neutral-950"
                  key={index}
                />
              ))}
        </div>
      </div>

      <div className="mt-3 space-y-1">
        <h2 className="text-lg font-semibold leading-6 text-white">
          {albumTitle}
        </h2>
        {description ? (
          <p className="whitespace-pre-wrap break-words text-[15px] leading-6 text-neutral-100">
            <LinkifiedText text={description} />
          </p>
        ) : null}
        <Link
          className="inline-flex rounded-full px-0 py-1 text-sm text-[#ff003c] transition hover:text-[#ff4d75] focus:outline-none focus-visible:text-[#ff4d75]"
          href={href}
        >
          ver album
        </Link>
      </div>

      <PhotoLightbox
        alt={(currentIndex) => `${albumTitle} ${currentIndex + 1}`}
        images={lightboxImages}
        index={openIndex}
        onClose={() => setOpenIndex(null)}
        onNavigate={setOpenIndex}
      />
    </div>
  );
}
