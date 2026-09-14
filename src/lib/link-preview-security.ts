import "server-only";

import { lookup } from "dns/promises";
import ipaddr from "ipaddr.js";

export type ResolvedAddress = { address: string; family: 4 | 6 };
export type AddressResolver = (hostname: string) => Promise<ResolvedAddress[]>;

const BLOCKED_HOSTNAME_SUFFIXES = [
  ".internal",
  ".invalid",
  ".lan",
  ".local",
  ".localhost",
  ".test",
];

export function isPublicIpAddress(address: string) {
  try {
    const parsed = ipaddr.parse(address);
    const ipv6Address =
      parsed.kind() === "ipv6" ? (parsed as ipaddr.IPv6) : null;
    const normalized =
      ipv6Address?.isIPv4MappedAddress() === true
        ? ipv6Address.toIPv4Address()
        : parsed;

    return normalized.range() === "unicast";
  } catch {
    return false;
  }
}

export async function resolvePublicAddresses(hostname: string) {
  const records = await lookup(hostname, { all: true, verbatim: true });

  return records.map(({ address, family }) => ({
    address,
    family: family as 4 | 6,
  }));
}

export async function validateExternalPreviewUrl(
  value: string,
  resolveAddresses: AddressResolver = resolvePublicAddresses
) {
  const url = new URL(value);
  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");

  if (
    (url.protocol !== "https:" && url.protocol !== "http:") ||
    url.username ||
    url.password ||
    (url.port && url.port !== "80" && url.port !== "443") ||
    !hostname ||
    hostname === "localhost" ||
    hostname === "metadata.google.internal" ||
    (!hostname.includes(".") && !ipaddr.isValid(hostname)) ||
    BLOCKED_HOSTNAME_SUFFIXES.some((suffix) => hostname.endsWith(suffix))
  ) {
    throw new Error("Unsafe link preview URL.");
  }

  const addresses = ipaddr.isValid(hostname)
    ? [
        {
          address: hostname,
          family: ipaddr.parse(hostname).kind() === "ipv4" ? 4 : 6,
        } as ResolvedAddress,
      ]
    : await resolveAddresses(hostname);

  if (
    addresses.length === 0 ||
    addresses.some(({ address }) => !isPublicIpAddress(address))
  ) {
    throw new Error("Link preview target is not public.");
  }

  return { addresses, url };
}
