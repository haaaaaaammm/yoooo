import "server-only";

import { createHash, randomBytes } from "crypto";
import { argon2id, hash, verify } from "argon2";
import { cookies, headers } from "next/headers";

import { getPrisma } from "@/lib/prisma";

const SESSION_COOKIE_NAME = "otrogato_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const SESSION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_ATTEMPT_RETENTION_MS = 24 * 60 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 5;
const DUMMY_PASSWORD_HASH =
  "$argon2id$v=19$m=65536,p=4,t=3$wGu8fkAFXy6+o0p0w64JXA$AcDyJvvSEWvqP9pgmmQ3LU5d1k6ZMapoi//JNfpCPNg";

export const DIFERENCIAS_USERNAME_MIN_LENGTH = 3;
export const DIFERENCIAS_USERNAME_MAX_LENGTH = 32;
export const DIFERENCIAS_DISPLAY_NAME_MAX_LENGTH = 100;
export const DIFERENCIAS_PASSWORD_MIN_LENGTH = 12;
export const DIFERENCIAS_PASSWORD_MAX_LENGTH = 128;

export type DiferenciasSessionUser = {
  avatarUrl: string | null;
  createdAt: Date;
  displayName: string;
  id: string;
  isActive: boolean;
  username: string;
};

export function normalizeDiferenciasUsername(value: string) {
  return value.trim().toLowerCase();
}

export function validateDiferenciasUsername(value: string) {
  if (value.length > DIFERENCIAS_USERNAME_MAX_LENGTH + 20) {
    return null;
  }

  const username = normalizeDiferenciasUsername(value);

  if (
    username.length < DIFERENCIAS_USERNAME_MIN_LENGTH ||
    username.length > DIFERENCIAS_USERNAME_MAX_LENGTH ||
    !/^[a-z0-9._-]+$/.test(username)
  ) {
    return null;
  }

  return username;
}

export function validateDiferenciasDisplayName(value: string) {
  if (value.length > DIFERENCIAS_DISPLAY_NAME_MAX_LENGTH + 20) {
    return null;
  }

  const displayName = value.trim();

  if (
    !displayName ||
    displayName.length > DIFERENCIAS_DISPLAY_NAME_MAX_LENGTH
  ) {
    return null;
  }

  return displayName;
}

export function validateDiferenciasPassword(value: string) {
  return (
    value.length >= DIFERENCIAS_PASSWORD_MIN_LENGTH &&
    value.length <= DIFERENCIAS_PASSWORD_MAX_LENGTH
  );
}

export async function hashDiferenciasPassword(password: string) {
  if (!validateDiferenciasPassword(password)) {
    throw new Error("Invalid password length.");
  }

  return hash(password, { type: argon2id });
}

export async function verifyDiferenciasPassword(
  passwordHash: string,
  password: string
) {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function getSessionCookieOptions(maxAge = SESSION_MAX_AGE_SECONDS) {
  return {
    httpOnly: true,
    maxAge,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
}

async function clearSessionCookie() {
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE_NAME, "", getSessionCookieOptions(0));
  cookieStore.set(SESSION_COOKIE_NAME, "", {
    ...getSessionCookieOptions(0),
    path: "/otrogato",
  });
}

export async function getDiferenciasSessionUser(): Promise<DiferenciasSessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token || !SESSION_TOKEN_PATTERN.test(token)) {
    return null;
  }

  const prisma = getPrisma();
  const session = await prisma.diferenciasSession.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    select: {
      expiresAt: true,
      id: true,
      user: {
        select: {
          avatarUrl: true,
          createdAt: true,
          displayName: true,
          id: true,
          isActive: true,
          username: true,
        },
      },
    },
  });

  if (!session) {
    return null;
  }

  if (session.expiresAt <= new Date() || !session.user.isActive) {
    try {
      await prisma.diferenciasSession.delete({ where: { id: session.id } });
    } catch {
      // Authorization is denied regardless of best-effort session cleanup.
    }

    return null;
  }

  return session.user;
}

export async function requireDiferenciasUser() {
  const user = await getDiferenciasSessionUser();

  if (!user) {
    throw new Error("DIFERENCIAS_AUTH_REQUIRED");
  }

  return user;
}

function getLoginAttemptKey(username: string, ipAddress: string) {
  return createHash("sha256")
    .update(`${username.slice(0, 128)}\u0000${ipAddress.slice(0, 128)}`)
    .digest("hex");
}

export async function getDiferenciasLoginIp() {
  const requestHeaders = await headers();

  return (
    requestHeaders.get("cf-connecting-ip") ||
    requestHeaders.get("x-real-ip") ||
    requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

async function isLoginRateLimited(keyHash: string) {
  const prisma = getPrisma();
  const windowStart = new Date(Date.now() - LOGIN_WINDOW_MS);

  const attempts = await prisma.diferenciasLoginAttempt.count({
    where: {
      attemptedAt: { gte: windowStart },
      keyHash,
    },
  });

  return attempts >= LOGIN_MAX_ATTEMPTS;
}

async function recordFailedLogin(keyHash: string) {
  const prisma = getPrisma();
  const retentionStart = new Date(Date.now() - LOGIN_ATTEMPT_RETENTION_MS);

  await prisma.$transaction([
    prisma.diferenciasLoginAttempt.create({ data: { keyHash } }),
    prisma.diferenciasLoginAttempt.deleteMany({
      where: { attemptedAt: { lt: retentionStart } },
    }),
  ]);
}

export type DiferenciasLoginResult =
  | { ok: true }
  | { ok: false; reason: "disabled" | "invalid" | "rate_limited" };

export async function loginDiferenciasUser(
  rawUsername: string,
  password: string,
  ipAddress: string
): Promise<DiferenciasLoginResult> {
  const normalizedForRateLimit = normalizeDiferenciasUsername(
    rawUsername.slice(0, DIFERENCIAS_USERNAME_MAX_LENGTH + 20)
  );
  const keyHash = getLoginAttemptKey(normalizedForRateLimit, ipAddress);

  if (await isLoginRateLimited(keyHash)) {
    return { ok: false, reason: "rate_limited" };
  }

  const username = validateDiferenciasUsername(rawUsername);
  const passwordHasValidLength = validateDiferenciasPassword(password);
  const prisma = getPrisma();
  const user = username
    ? await prisma.diferenciasUser.findUnique({
        where: { username },
        select: {
          id: true,
          isActive: true,
          passwordHash: true,
        },
      })
    : null;
  const hashToVerify = user?.passwordHash ?? DUMMY_PASSWORD_HASH;
  const passwordMatches = await verifyDiferenciasPassword(
    hashToVerify,
    passwordHasValidLength ? password : "invalid-password"
  );

  if (!user || !passwordMatches || !passwordHasValidLength) {
    await recordFailedLogin(keyHash);
    return { ok: false, reason: "invalid" };
  }

  if (!user.isActive) {
    await recordFailedLogin(keyHash);
    return { ok: false, reason: "disabled" };
  }

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);

  await prisma.$transaction([
    prisma.diferenciasSession.create({
      data: {
        expiresAt,
        tokenHash: hashSessionToken(token),
        userId: user.id,
      },
    }),
    prisma.diferenciasUser.update({
      data: { lastLoginAt: new Date() },
      where: { id: user.id },
    }),
    prisma.diferenciasSession.deleteMany({
      where: {
        expiresAt: { lte: new Date() },
        userId: user.id,
      },
    }),
    prisma.diferenciasLoginAttempt.deleteMany({ where: { keyHash } }),
  ]);

  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE_NAME, "", {
    ...getSessionCookieOptions(0),
    path: "/otrogato",
  });
  cookieStore.set(
    SESSION_COOKIE_NAME,
    token,
    getSessionCookieOptions(SESSION_MAX_AGE_SECONDS)
  );

  return { ok: true };
}

export async function logoutDiferenciasUser() {
  const cookieStore = await cookies();
  const tokenHashes = [
    ...new Set(
      cookieStore
        .getAll(SESSION_COOKIE_NAME)
        .map(({ value }) => value)
        .filter((token) => SESSION_TOKEN_PATTERN.test(token))
        .map(hashSessionToken)
    ),
  ];

  if (tokenHashes.length > 0) {
    await getPrisma().diferenciasSession.deleteMany({
      where: { tokenHash: { in: tokenHashes } },
    });
  }

  await clearSessionCookie();
}
