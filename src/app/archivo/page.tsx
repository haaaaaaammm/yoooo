import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import AdminPostLink from "@/app/_components/admin-post-link";
import LinkifiedText from "@/app/_components/linkified-text";
import NumberedPagination from "@/app/_components/numbered-pagination";
import { ARCHIVO_ALBUM_KIND } from "@/lib/archivo";
import {
  formatArchivoTimestamp,
  getArchivoPostsPage,
} from "@/lib/archivo-posts";
import { ADMIN_PATH, ARCHIVO_PATH, parsePageParam } from "@/lib/posts";

import ArchivoAlbumCard from "./archivo-album-card";
import ArchivoCardMenu from "./archivo-card-menu";
import ArchivoCarousel from "./archivo-carousel";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "archivo",
  description: "archivo visual",
  openGraph: {
    title: "archivo",
    description: "archivo visual",
    url: "https://haaaaaaammmm.com/archivo",
    siteName: "yo",
    locale: "es_ES",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "archivo",
    description: "archivo visual",
  },
};

type ArchivoPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};
type ArchivoListPost = Awaited<
  ReturnType<typeof getArchivoPostsPage>
>["posts"][number];

function getExcerpt(value: string, maxLength = 140) {
  const excerpt = value.replace(/\s+/g, " ").trim();

  if (excerpt.length <= maxLength) {
    return excerpt;
  }

  return `${excerpt.slice(0, maxLength - 1).trim()}...`;
}

function albumCardProps(post: ArchivoListPost) {
  const coverImage = post.coverImage ?? post.images[0] ?? null;
  const previewImages = post.images
    .filter((image) => image.id !== coverImage?.id)
    .slice(0, 3)
    .map((image) => ({ id: image.id, url: image.url }));

  return {
    coverImage: coverImage
      ? { id: coverImage.id, url: coverImage.url }
      : null,
    description: post.description ? getExcerpt(post.description) : "",
    href: `${ARCHIVO_PATH}/album/${post.id}`,
    imageCount: post.imageCount,
    previewImages,
    takenAtIso: post.takenAt.toISOString(),
    takenAtLabel: formatArchivoTimestamp(post.takenAt),
    title: post.title ?? null,
  };
}

export default async function ArchivoPage({ searchParams }: ArchivoPageProps) {
  const params = (await searchParams) ?? {};
  const page = parsePageParam(params.page);
  const { posts, totalPages } = await getArchivoPostsPage(page);

  // Out-of-range page (e.g. posts were deleted): send to the last valid page so
  // the URL, content, and highlighted page number stay in sync.
  if (totalPages > 0 && page > totalPages) {
    redirect(`${ARCHIVO_PATH}?page=${totalPages}`);
  }

  return (
    <main className="min-h-screen min-h-dvh overflow-x-hidden bg-black text-white">
      <div className="mx-auto min-h-screen min-h-dvh w-full max-w-2xl border-neutral-800 bg-black sm:border-x">
        <header className="sticky top-0 z-10 border-b border-neutral-800 bg-black/90 px-4 py-4 backdrop-blur">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <Link
                aria-label="Inicio"
                className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-lg text-[#ff003c] transition hover:bg-[#ff003c]/10"
                href="/"
              >
                {"<"}
              </Link>
              <h1 className="min-w-0 truncate text-xl font-semibold tracking-wide text-white">
                archivo
              </h1>
            </div>
            <AdminPostLink href={`${ADMIN_PATH}?app=archivo`} />
          </div>
        </header>

        <section aria-label="Archivo">
          {posts.length === 0 ? (
            <p className="border-b border-neutral-800 px-4 py-10 text-center text-sm leading-6 text-neutral-500">
              todavia no hay archivo
            </p>
          ) : (
            <ol>
              {posts.map((post) => (
                <li
                  className="border-b border-neutral-800 transition hover:bg-neutral-950"
                  key={post.id}
                >
                  <article className="px-4 py-4">
                    {post.kind === ARCHIVO_ALBUM_KIND ? (
                      <ArchivoAlbumCard {...albumCardProps(post)} />
                    ) : (
                      <>
                        <div className="flex items-center justify-between gap-2">
                          <time
                            className="text-sm leading-5 text-neutral-500"
                            dateTime={post.takenAt.toISOString()}
                          >
                            {formatArchivoTimestamp(post.takenAt)}
                          </time>
                          <ArchivoCardMenu path={`${ARCHIVO_PATH}/${post.id}`} />
                        </div>

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

                        
                      </>
                    )}
                  </article>
                </li>
              ))}
            </ol>
          )}
          <NumberedPagination
            basePath={ARCHIVO_PATH}
            page={page}
            totalPages={totalPages}
          />
        </section>
      </div>
    </main>
  );
}
