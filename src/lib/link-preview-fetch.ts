import "server-only";

import { request as requestHttp } from "http";
import { request as requestHttps } from "https";
import { parse } from "node-html-parser";
import { StringDecoder } from "string_decoder";

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

type ParsedPreviewMetadata = Omit<ExternalPreviewMetadata, "url">;

export class BoundedHtmlHeadReader {
  private body = "";
  private readonly decoder = new StringDecoder("utf8");
  private receivedBytes = 0;

  append(chunk: Buffer) {
    this.receivedBytes += chunk.length;

    if (this.receivedBytes > MAX_BODY_BYTES) {
      throw new Error("Link preview response is too large.");
    }

    this.body += this.decoder.write(chunk);
    const headEnd = this.body.toLowerCase().indexOf("</head>");

    return headEnd >= 0
      ? this.body.slice(0, headEnd + "</head>".length)
      : null;
  }

  finish() {
    return this.body + this.decoder.end();
  }
}

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

function getSchemaTypes(value: unknown) {
  const types =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)["@type"]
      : null;

  return Array.isArray(types)
    ? types.filter((type): type is string => typeof type === "string")
    : typeof types === "string"
      ? [types]
      : [];
}

function getSchemaRecords(value: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(value)) {
    return value.flatMap(getSchemaRecords);
  }

  if (!value || typeof value !== "object") {
    return [];
  }

  const record = value as Record<string, unknown>;
  const graphRecords = getSchemaRecords(record["@graph"]);

  return [record, ...graphRecords];
}

function getSchemaString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function getSchemaImage(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(getSchemaImage).find(Boolean);
  }

  if (value && typeof value === "object") {
    const image = value as Record<string, unknown>;

    return getSchemaString(image.contentUrl) ?? getSchemaString(image.url);
  }

  return undefined;
}

function getSchemaArtistNames(value: unknown) {
  const artists = Array.isArray(value) ? value : value ? [value] : [];

  return artists
    .map((artist) =>
      artist && typeof artist === "object"
        ? getSchemaString((artist as Record<string, unknown>).name)
        : undefined
    )
    .filter((artist): artist is string => Boolean(artist?.trim()));
}

export function parseAppleMusicMetadata(
  html: string,
  pageUrl: string
): ParsedPreviewMetadata | null {
  const url = new URL(pageUrl);

  if (url.hostname.toLowerCase() !== "music.apple.com") {
    return null;
  }

  const root = parse(html);
  const schemaRecords = root
    .querySelectorAll('script[type="application/ld+json"]')
    .flatMap((script) => {
      try {
        return getSchemaRecords(JSON.parse(script.text));
      } catch {
        return [];
      }
    });
  const schema = schemaRecords.find((record) =>
    getSchemaTypes(record).some((type) =>
      ["MusicAlbum", "MusicComposition", "MusicRecording"].includes(type)
    )
  );

  if (!schema) {
    return null;
  }

  const audio =
    schema.audio && typeof schema.audio === "object"
      ? (schema.audio as Record<string, unknown>)
      : null;
  const album =
    (audio?.inAlbum ?? schema.inAlbum) &&
    typeof (audio?.inAlbum ?? schema.inAlbum) === "object"
      ? ((audio?.inAlbum ?? schema.inAlbum) as Record<string, unknown>)
      : null;
  const artistNames = getSchemaArtistNames(
    audio?.byArtist ?? schema.byArtist ?? album?.byArtist
  );
  const title = cleanMetadata(
    getSchemaString(audio?.name) ?? getSchemaString(schema.name),
    200
  );
  const description = cleanMetadata(
    artistNames.length > 0
      ? artistNames.join(" & ")
      : getSchemaString(audio?.description) ??
          getSchemaString(schema.description),
    500
  );
  const rawImageUrl = cleanMetadata(
    getSchemaImage(album?.image) ??
      getSchemaImage(audio?.image) ??
      getSchemaImage(schema.image),
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

  return {
    description,
    imageUrl,
    siteName: "Apple Music",
    title,
  };
}

export function resolveLinkPreviewMetadata(html: string, pageUrl: string) {
  const genericMetadata = parseLinkPreviewHtml(html, pageUrl);
  const appleMusicMetadata = parseAppleMusicMetadata(html, pageUrl);

  return appleMusicMetadata
    ? {
        description:
          appleMusicMetadata.description ?? genericMetadata.description,
        imageUrl: appleMusicMetadata.imageUrl ?? genericMetadata.imageUrl,
        siteName: appleMusicMetadata.siteName ?? genericMetadata.siteName,
        title: appleMusicMetadata.title ?? genericMetadata.title,
      }
    : genericMetadata;
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

        if (
          status < 200 ||
          status >= 300 ||
          !/^(?:text\/html|application\/xhtml\+xml)(?:;|$)/i.test(
            contentType
          )
        ) {
          response.resume();
          reject(new Error("Unsupported link preview response."));
          return;
        }

        const reader = new BoundedHtmlHeadReader();

        response.on("data", (chunk: Buffer) => {
          let head: string | null;

          try {
            head = reader.append(chunk);
          } catch (error) {
            previewRequest.destroy(error as Error);
            return;
          }

          if (head !== null) {
            response.destroy();
            resolve({
              body: head,
              contentType,
              status,
            });
          }
        });
        response.on("end", () => {
          resolve({
            body: reader.finish(),
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

    const metadata = resolveLinkPreviewMetadata(
      response.body ?? "",
      currentUrl
    );

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
