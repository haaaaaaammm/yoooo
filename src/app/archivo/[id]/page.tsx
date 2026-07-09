import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import LinkifiedText from "@/app/_components/linkified-text";
import { ARCHIVO_ALBUM_KIND } from "@/lib/archivo";
import {
  formatArchivoTimestamp,
  getArchivoPostById,
} from "@/lib/archivo-posts";
import { ARCHIVO_PATH } from "@/lib/posts";

import ArchivoCarousel from "../archivo-carousel";
import CopyLinkButton from "./copy-link-button";

export const dynamic = "force-dynamic";

type ArchivoPostPageProps = {
  params: Promise<{ id: string }>;
};

function getExcerpt(value: string, maxLength = 90) {
  const excerpt = value.replace(/\s+/g, " ").trim();

  if (excerpt.length <= maxLength) {
    return excerpt;
  }

  return `${excerpt.slice(0, maxLength - 1).trim()}...`;
}

export async function generateMetadata({
  params,
}: ArchivoPostPageProps): Promise<Metadata> {
  const { id } = await params;
  const post = await getArchivoPostById(id);

  if (!post) {
    return {
      title: "archivo",
      description: "archivo visual",
    };
  }

  const excerpt = getExcerpt(post.description);
  const date = formatArchivoTimestamp(post.takenAt);
  const title = excerpt ? `${excerpt} | archivo` : `${date} | archivo`;
  const description = excerpt || date;
  const firstImage = post.images[0];

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `https://haaaaaaammmm.com${ARCHIVO_PATH}/${post.id}`,
      siteName: "yo",
      locale: "es_ES",
      type: "article",
      images: firstImage ? [{ url: firstImage.url }] : undefined,
    },
    twitter: {
      card: firstImage ? "summary_large_image" : "summary",
      title,
      description,
      images: firstImage ? [firstImage.url] : undefined,
    },
  };
}

export default async function ArchivoPostPage({
  params,
}: ArchivoPostPageProps) {
  const { id } = await params;
  const post = await getArchivoPostById(id);

  if (!post) {
    notFound();
  }

  if (post.kind === ARCHIVO_ALBUM_KIND) {
    redirect(`${ARCHIVO_PATH}/album/${post.id}`);
  }

  return (
    <main className="min-h-screen min-h-dvh overflow-x-hidden bg-black text-white">
      <div className="mx-auto min-h-screen min-h-dvh w-full max-w-2xl border-neutral-800 bg-black sm:border-x">
        <header className="sticky top-0 z-10 border-b border-neutral-800 bg-black/90 px-4 py-4 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Link
                aria-label="Volver al archivo"
                className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-lg text-[#ff003c] transition hover:bg-[#ff003c]/10"
                href={ARCHIVO_PATH}
              >
                &lt;
              </Link>
              <Link
                className="min-w-0 truncate text-xl font-semibold tracking-wide text-white"
                href={ARCHIVO_PATH}
              >
                archivo
              </Link>
            </div>
            <CopyLinkButton />
          </div>
        </header>

        <article className="border-b border-neutral-800 px-4 py-4">
          <time
            className="text-sm leading-5 text-neutral-500"
            dateTime={post.takenAt.toISOString()}
          >
            {formatArchivoTimestamp(post.takenAt)}
          </time>

          <ArchivoCarousel
            description={post.description}
            enableLightbox
            images={post.images.map((image) => ({
              id: image.id,
              url: image.url,
            }))}
          />

          {post.description ? (
            <p className="mt-3 whitespace-pre-wrap break-words text-[15px] leading-6 text-neutral-100">
              <LinkifiedText text={post.description} />
            </p>
          ) : null}
        </article>
      </div>
    </main>
  );
}
