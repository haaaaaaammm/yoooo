const DEFAULT_SITE_ORIGIN = "https://haaaaaaammmm.com";

export const SITE_ORIGIN = (
  process.env.NEXT_PUBLIC_SITE_ORIGIN ?? DEFAULT_SITE_ORIGIN
).replace(/\/$/, "");

export function isOwnSiteUrl(url: URL) {
  return url.origin === SITE_ORIGIN;
}
