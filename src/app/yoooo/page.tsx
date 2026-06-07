
import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";

import FeedPagination from "@/app/_components/feed-pagination";
import { getArchivePostsPage } from "@/lib/archive-posts";
import { getAdminAuthStatus, isAdminAuthenticated } from "@/lib/auth";
import { getPoemarioPostsPage } from "@/lib/poemario-posts";
import {
  ADMIN_PATH,
  ARCHIVE_PATH,
  POSTS_PER_PAGE,
  PUBLIC_FEED_PATH,
  parsePageParam,
} from "@/lib/posts";
import { getProfileImageSettings } from "@/lib/site-settings";

import AdminPostCard from "./admin-post-card";
import ArchiveManager from "./archive-manager";
import { loginAction } from "./actions";
import Composer from "./composer";
import ModeSwitcher from "./mode-switcher";
import ProfileImageUpload from "./profile-image-upload";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "yoooo",
  description: "aquí posteo y eso:pp",
  robots: {
    index: false,
    follow: false,
  },
};

type AdminPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type AdminMode = "archive" | "poemario";

function getParam(
  params: Record<string, string | string[] | undefined>,
  key: string
) {
  const value = params[key];

  return Array.isArray(value) ? value[0] : value;
}

function parseAdminMode(value: string | undefined): AdminMode {
  return value === "archive" ? "archive" : "poemario";
}

function getStatusMessage(error?: string, published?: string, deleted?: string) {
  if (published) {
    return { tone: "ok", text: "posteado" };
  }

  if (deleted) {
    return { tone: "ok", text: "post eliminado" };
  }

  switch (error) {
    case "auth":
      return { tone: "error", text: "vuelve a iniciar sesion" };
    case "config":
      return {
        tone: "error",
        text: "Faltan variables de entorno para activar el acceso privado.",
      };
    case "empty":
      return { tone: "error", text: "Escribe algo antes de publicar." };
    case "invalid":
      return { tone: "error", text: "Usuario o password incorrecto." };
    case "delete":
      return { tone: "error", text: "No se pudo eliminar el post." };
    case "not_found":
      return { tone: "error", text: "Ese post ya no existe." };
    default:
      return null;
  }
}

export default async function Home({ searchParams }: AdminPageProps) {
  const params = (await searchParams) ?? {};
  const message = getStatusMessage(
    getParam(params, "error"),
    getParam(params, "published"),
    getParam(params, "deleted")
  );
  const mode = parseAdminMode(getParam(params, "app"));
  const page = parsePageParam(params.page);
  const isAuthenticated = await isAdminAuthenticated();

  if (!isAuthenticated) {
    const authStatus = getAdminAuthStatus();

    return (
      <main className="min-h-dvh bg-black px-5 py-10 text-white">
        <div className="mx-auto flex min-h-[calc(100dvh-5rem)] w-full max-w-sm flex-col justify-center">
          <div className="rounded-3xl border border-neutral-800 bg-neutral-950/70 p-6">
            <p className="text-xs uppercase tracking-[0.28em] text-neutral-500">
              private
            </p>
            <h1 className="mt-3 text-3xl font-semibold text-white">yoooo</h1>

            <form action={loginAction} className="mt-8 space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm text-neutral-400">
                  username
                </span>
                <input
                  className="w-full rounded-2xl border border-neutral-800 bg-black px-4 py-3 text-base text-white outline-none transition placeholder:text-neutral-600 focus:border-neutral-500 focus:ring-1 focus:ring-neutral-500/40"
                  name="username"
                  autoComplete="username"
                  required
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm text-neutral-400">
                  password
                </span>
                <input
                  className="w-full rounded-2xl border border-neutral-800 bg-black px-4 py-3 text-base text-white outline-none transition placeholder:text-neutral-600 focus:border-neutral-500 focus:ring-1 focus:ring-neutral-500/40"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </label>

              {message ? (
                <p
                  className={
                    message.tone === "error"
                      ? "text-sm text-red-400"
                      : "text-sm text-green-400"
                  }
                >
                  {message.text}
                </p>
              ) : null}

              {!authStatus.ok ? (
                <p className="text-sm text-red-400">
                  Configura {authStatus.missing.join(", ")} en .env.
                </p>
              ) : null}

              <button
                className="w-full rounded-full px-5 py-3 text-sm font-semibold text-[#ff003c] transition hover:bg-[#ff003c]/10 disabled:cursor-not-allowed disabled:text-neutral-500 disabled:hover:bg-transparent"
                type="submit"
              >
                entrar
              </button>
            </form>
          </div>
        </div>
      </main>
    );
  }

  const profileImageSettings = await getProfileImageSettings();
  const profileImageUrl = profileImageSettings.profileImageUrl;
  const publicTargetPath = mode === "archive" ? ARCHIVE_PATH : PUBLIC_FEED_PATH;
  const publicTargetLabel = mode === "archive" ? "< archive" : "< poemario";
  let pageContent: ReactNode;

  if (mode === "archive") {
    const { posts: archivePosts, totalPages } = await getArchivePostsPage(page);

    // Out-of-range page (e.g. posts were deleted): send to the last valid page
    // so the URL, content, and highlighted page number stay in sync.
    if (totalPages > 0 && page > totalPages) {
      redirect(`${ADMIN_PATH}?app=archive&page=${totalPages}`);
    }

    pageContent = (
      <ArchiveManager
        page={page}
        posts={archivePosts.map((post) => ({
          createdAt: post.createdAt.toISOString(),
          description: post.description,
          id: post.id,
          images: post.images.map((image) => ({
            id: image.id,
            key: image.key,
            order: image.order,
            url: image.url,
          })),
          takenAt: post.takenAt.toISOString(),
        }))}
        totalPages={totalPages}
      />
    );
  } else {
    const { posts, totalPosts } = await getPoemarioPostsPage(page);
    const hasNextPage = page * POSTS_PER_PAGE < totalPosts;

    pageContent = (
      <>
        <Composer profileImageUrl={profileImageUrl} />

        <section aria-label="Posts">
          {posts.length === 0 ? (
            <p className="border-b border-neutral-800 px-4 py-10 text-center text-sm leading-6 text-neutral-500">
              todavia no hay posts
            </p>
          ) : (
            <ol>
              {posts.map((post) => (
                <AdminPostCard
                  href={`${ADMIN_PATH}/poemario/${post.id}`}
                  key={post.id}
                  post={{
                    commentCount: post.commentCount,
                    id: post.id,
                    content: post.content,
                    createdAt: post.createdAt.toISOString(),
                  }}
                  profileImageUrl={profileImageUrl}
                />
              ))}
            </ol>
          )}
          <FeedPagination
            basePath={ADMIN_PATH}
            hasNextPage={hasNextPage}
            page={page}
          />
        </section>
      </>
    );
  }

  return (
    <main className="min-h-dvh overflow-x-hidden bg-black text-white">
      <div className="mx-auto min-h-dvh w-full max-w-2xl border-neutral-800 sm:border-x">
        <header className="sticky top-0 z-10 border-b border-neutral-800 bg-black/90 px-4 py-4 backdrop-blur">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold tracking-wide text-white">
                yoooo
              </h1>
            </div>
            <div className="flex flex-none items-center gap-2">
              <ProfileImageUpload />
              <Link
                className="rounded-full px-4 py-2 text-sm text-[#ff003c] transition hover:bg-[#ff003c]/10"
                href={publicTargetPath}
              >
                {publicTargetLabel}
              </Link>
            </div>
          </div>
        </header>

        {message ? (
          <div
            className={
              message.tone === "error"
                ? "border-b border-neutral-800 px-4 py-3 text-sm text-[#ff003c]"
                : "border-b border-neutral-800 px-4 py-3 text-sm text-[#ff003c]"
            }
          >
            {message.text}
          </div>
        ) : null}

        <ModeSwitcher activeMode={mode} />

        {pageContent}
      </div>
    </main>
  );
}
