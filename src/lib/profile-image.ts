export const DEFAULT_PROFILE_IMAGE_URL = "/images/pfp.jpg";

export function resolveProfileImageUrl(profileImageUrl?: string | null) {
  return profileImageUrl?.trim() || DEFAULT_PROFILE_IMAGE_URL;
}
