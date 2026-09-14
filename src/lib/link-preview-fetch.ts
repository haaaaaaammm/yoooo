import "server-only";

import { request as requestHttp } from "http";
import { request as requestHttps } from "https";
import { parse } from "node-html-parser";

import {
  type AddressResolver,
  resolvePublicAddresses,
  validateExternalPreviewUrl,
} from "./link-preview-security";

const FETCH_TIMEOUT_MS = 4_000;
const MAX_BODY_BYTES = 256 * 1024;
const MAX_REDIRECTS = 3;
const USER_AGENT = "haaaaaaammmm-link-preview/1.0";

type PreviewResponse = {
  body?: string;
  contentType?: string;
  location?: string;
  status: number;
};

export type PreviewRequester = (
  target: Awaited<ReturnType<typeof validateExternalPreviewUrl>>
) => Promise<PreviewResponse>;

export type ExternalPreviewMetadata = {
  description: string | null;
  imageUrl: string | null;
  siteName: string | null;
  title: string | null;
  url: string;
};

function cleanMetadata(value: string | undefined, maxLength: number) {
  const normalized = value?.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return null;
  }

  return normalized.slice(0, maxLength);
}

function getMetaContent(
  root: ReturnType<typeof parse>,
  selectors: string[]
) {
  for (const selector of selectors) {
    const value = root.querySelector(selector)?.getAttribute("content");

    if (value?.trim()) {
      return value;
    }
  }

  return undefined;
}

export function parseLinkPreviewHtml(html: string, pageUrl: string) {
  const root = parse(html);
  const title = cleanMetadata(
    getMetaContent(root, [
      'meta[property="og:title"]',
      'meta[name="twitter:title"]',
    ]) ?? root.querySelector("title")?.text,
    200
  );
  const description = cleanMetadata(
    getMetaContent(root, [
      'meta[property="og:description"]',
      'meta[name="twitter:description"]',
      'meta[name="description"]',
    ]),
    500
  );
  const siteName = cleanMetadata(
    getMetaContent(root, ['meta[property="og:site_name"]']),
    100
  );
  const rawImageUrl = cleanMetadata(
    getMetaContent(root, [
      'meta[property="og:image:secure_url"]',
      'meta[property="og:image"]',
      'meta[name="twitter:image"]',
    ]),
    2_048
  );
  let imageUrl: string | null = null;

  if (rawImageUrl) {
    try {
      imageUrl = new URL(rawImageUrl, pageUrl).toString();
    } catch {
      imageUrl = null;
    }
  }

  return { description, imageUrl, siteName, title };
}

export async function requestPreviewHtml(
  target: Awaited<ReturnType<typeof validateExternalPreviewUrl>>
): Promise<PreviewResponse> {
  const { addresses, url } = target;
  const selectedAddress = addresses[0];
  const request = url.protocol === "https:" ? requestHttps : requestHttp;

  return new Promise((resolve, reject) => {
    const previewRequest = request(
      {
        headers: {
          Accept: "text/html,application/xhtml+xml;q=0.9",
          Host: url.host,
          "User-Agent": USER_AGENT,
        },
        hostname: selectedAddress.address,
        method: "GET",
        path: `${url.pathname}${url.search}`,
        port: url.port || (url.protocol === "https:" ? 443 : 80),
        protocol: url.protocol,
        servername: url.protocol === "https:" ? url.hostname : undefined,
      },
      (response) => {
        const status = response.statusCode ?? 0;
        const location = response.headers.location;

        if (status >= 300 && status < 400 && location) {
          response.resume();
          resolve({ location, status });
          return;
        }

        const contentType = String(response.headers["content-type"] ?? "");
        const contentLength = Number(response.headers["content-length"] ?? 0);

        if (
          status < 200 ||
          status >= 300 ||
          !/^(?:text\/html|application\/xhtml\+xml)(?:;|$)/i.test(
            contentType
          ) ||
          (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES)
        ) {
          response.resume();
          reject(new Error("Unsupported link preview response."));
          return;
        }

        const chunks: Buffer[] = [];
        let receivedBytes = 0;

        response.on("data", (chunk: Buffer) => {
          receivedBytes += chunk.length;

          if (receivedBytes > MAX_BODY_BYTES) {
            previewRequest.destroy(new Error("Link preview response is too large."));
            return;
          }

          chunks.push(chunk);
        });
        response.on("end", () => {
          resolve({
            body: Buffer.concat(chunks).toString("utf8"),
            contentType,
            status,
          });
        });
        response.on("error", reject);
      }
    );

    previewRequest.setTimeout(FETCH_TIMEOUT_MS, () => {
      previewRequest.destroy(new Error("Link preview request timed out."));
    });
    previewRequest.on("error", reject);
    previewRequest.end();
  });
}

export async function fetchExternalLinkPreview(
  value: string,
  dependencies: {
    request?: PreviewRequester;
    resolveAddresses?: AddressResolver;
  } = {}
): Promise<ExternalPreviewMetadata> {
  const request = dependencies.request ?? requestPreviewHtml;
  const resolveAddresses =
    dependencies.resolveAddresses ?? resolvePublicAddresses;
  let currentUrl = value;

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    const target = await validateExternalPreviewUrl(
      currentUrl,
      resolveAddresses
    );
    const response = await request(target);

    if (response.location) {
      if (redirectCount === MAX_REDIRECTS) {
        throw new Error("Too many link preview redirects.");
      }

      currentUrl = new URL(response.location, target.url).toString();
      continue;
    }

    const metadata = parseLinkPreviewHtml(response.body ?? "", currentUrl);

    if (metadata.imageUrl) {
      try {
        await validateExternalPreviewUrl(metadata.imageUrl, resolveAddresses);
      } catch {
        metadata.imageUrl = null;
      }
    }

    return { ...metadata, url: currentUrl };
  }

  throw new Error("Unable to resolve link preview.");
}
