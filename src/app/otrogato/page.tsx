import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import NumberedPagination from "@/app/_components/numbered-pagination";
import { getDiferenciasSessionUser } from "@/lib/diferencias-auth";
import { getDiferenciasPostsPage } from "@/lib/diferencias-posts";
import { getDiferenciasVapidPublicKey } from "@/lib/diferencias-push";
import {
  DIFERENCIAS_PATH,
  OTROGATO_PATH,
  parsePageParam,
} from "@/lib/posts";

import { logoutAction } from "./actions";
import Composer from "./composer";
import LoginForm from "./login-form";
import LogoutButton from "./logout-button";
import PostManager from "./post-manager";
import ProfilePanel from "./profile-panel";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: "otrogato",
};

type OtrogatoPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function OtrogatoPage({
  searchParams,
}: OtrogatoPageProps) {
  const user = await getDiferenciasSessionUser();

  if (!user) {
    return <LoginForm />;
  }

  const params = (await searchParams) ?? {};
  const page = parsePageParam(params.page);
  const { posts, totalPages } = await getDiferenciasPostsPage(page);

  if (totalPages > 0 && page > totalPages) {
    redirect(`${OTROGATO_PATH}?page=${totalPages}`);
  }

  return (
    <main className="min-h-dvh overflow-x-hidden bg-black text-white">
      <div className="mx-auto min-h-dvh w-full max-w-2xl border-neutral-800 sm:border-x">
        <header className="sticky top-0 z-10 border-b border-neutral-800 bg-black/90 px-4 py-4 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="min-w-0 truncate text-xl font-semibold tracking-wide text-white">
              otrogato
            </h1>
            <div className="flex flex-none items-center gap-2">
              <form action={logoutAction}>
                <LogoutButton />
              </form>
              <Link
                className="rounded-full px-4 py-2 text-sm text-[#ff003c] transition hover:bg-[#ff003c]/10"
                href={DIFERENCIAS_PATH}
              >
                {"< diferencias"}
              </Link>
            </div>
          </div>
        </header>

        <ProfilePanel
          avatarUrl={user.avatarUrl}
          displayName={user.displayName}
          username={user.username}
          vapidPublicKey={getDiferenciasVapidPublicKey()}
        />
        <Composer
          avatarUrl={user.avatarUrl}
          currentPage={page}
          displayName={user.displayName}
        />

        <section aria-labelledby="diferencias-feed-heading">
          <h2
            className="border-b border-neutral-800 px-4 py-3 text-sm font-semibold text-neutral-400"
            id="diferencias-feed-heading"
          >
            Posts
          </h2>
          <PostManager
            posts={posts.map((post) => ({
              avatarUrl: post.customAuthorAvatarUrl,
              commentCount: post.commentCount,
              content: post.content,
              createdAt: post.createdAt.toISOString(),
              displayName: post.customAuthorName ?? user.displayName,
              id: post.id,
              isOwner: post.authorId === user.id,
            }))}
          />
          <NumberedPagination
            basePath={OTROGATO_PATH}
            page={page}
            totalPages={totalPages}
          />
        </section>
      </div>
    </main>
  );
}
