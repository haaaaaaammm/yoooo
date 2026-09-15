import "server-only";

import { getDiferenciasSessionUser } from "./diferencias-auth";
import {
  addLinkPreviewsToPosts,
  classifyPreviewUrl,
  type LinkPreviewData,
} from "./link-previews";
import { getPrisma } from "./prisma";
import { getFirstPreviewUrl } from "./text-links";

type OtrogatoPreviewTarget = Extract<
  ReturnType<typeof classifyPreviewUrl>,
  { kind: "otrogato" }
>;

function getOtrogatoPreviewTarget(content: string) {
  const firstUrl = getFirstPreviewUrl(content);

  if (!firstUrl) {
    return null;
  }

  const target = classifyPreviewUrl(firstUrl);

  return target.kind === "otrogato" ? target : null;
}

export async function addAuthenticatedOtrogatoPreviewsToPosts<
  T extends { content: string }
>(posts: T[]): Promise<Array<T & { preview: LinkPreviewData | null }>> {
  const postsWithPublicSafePreviews = await addLinkPreviewsToPosts(posts);
  const targets = posts.map((post) => getOtrogatoPreviewTarget(post.content));
  const referencedIds = [
    ...new Set(
      targets
        .filter((target): target is OtrogatoPreviewTarget => Boolean(target))
        .map((target) => target.id)
    ),
  ];

  if (referencedIds.length === 0) {
    return postsWithPublicSafePreviews;
  }

  const authenticatedUser = await getDiferenciasSessionUser();

  if (!authenticatedUser) {
    return postsWithPublicSafePreviews;
  }

  const referencedPosts = await getPrisma().diferenciasPost.findMany({
    select: {
      _count: { select: { comments: true } },
      author: { select: { avatarUrl: true, displayName: true } },
      content: true,
      createdAt: true,
      id: true,
    },
    where: { id: { in: referencedIds } },
  });
  const referencedPostById = new Map(
    referencedPosts.map((post) => [post.id, post])
  );

  return postsWithPublicSafePreviews.map((post, index) => {
    const target = targets[index];

    if (!target) {
      return post;
    }

    const referencedPost = referencedPostById.get(target.id);

    return {
      ...post,
      preview: referencedPost
        ? {
            authorAvatarUrl: referencedPost.author.avatarUrl,
            authorName: referencedPost.author.displayName,
            commentCount: referencedPost._count.comments,
            description: referencedPost.content,
            kind: "internal-repost" as const,
            publishedAt: referencedPost.createdAt.toISOString(),
            siteName: "otrogato",
            url: target.url,
          }
        : { kind: "unavailable" as const, url: target.url },
    };
  });
}
