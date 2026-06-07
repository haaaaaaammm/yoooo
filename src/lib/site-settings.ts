import "server-only";

import { resolveProfileImageUrl } from "@/lib/profile-image";
import { getPrisma } from "@/lib/prisma";

export const SITE_SETTINGS_ID = "default";

export async function getProfileImageSettings() {
  const settings = await getPrisma().siteSettings.findUnique({
    where: { id: SITE_SETTINGS_ID },
    select: {
      profileImageKey: true,
      profileImageUrl: true,
    },
  });

  return {
    profileImageKey: settings?.profileImageKey ?? null,
    profileImageUrl: resolveProfileImageUrl(settings?.profileImageUrl),
  };
}
