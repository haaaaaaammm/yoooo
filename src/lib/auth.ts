import "server-only";

import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

const SESSION_COOKIE_NAME = "yoooo_admin_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const AUTH_SECRET_MIN_LENGTH = 32;

type AdminConfig =
  | {
      ok: true;
      username: string;
      password: string;
      authSecret: string;
    }
  | {
      ok: false;
      missing: string[];
    };

type SessionPayload = {
  version: 1;
  username: string;
  expiresAt: number;
};

function readAdminConfig(): AdminConfig {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  const authSecret = process.env.AUTH_SECRET;
  const missing: string[] = [];

  if (!username) {
    missing.push("ADMIN_USERNAME");
  }

  if (!password) {
    missing.push("ADMIN_PASSWORD");
  }

  if (!authSecret || authSecret.length < AUTH_SECRET_MIN_LENGTH) {
    missing.push("AUTH_SECRET");
  }

  if (!username || !password || !authSecret || missing.length > 0) {
    return { ok: false, missing };
  }

  return { ok: true, username, password, authSecret };
}

function hmac(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function safeCredentialEqual(input: string, expected: string, secret: string) {
  return safeEqual(hmac(input, secret), hmac(expected, secret));
}

function encodeSession(payload: SessionPayload, secret: string) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = hmac(body, secret);

  return `${body}.${signature}`;
}

function decodeSession(value: string | undefined, secret: string) {
  if (!value) {
    return null;
  }

  const [body, signature] = value.split(".");

  if (!body || !signature || !safeEqual(signature, hmac(body, secret))) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8")
    ) as SessionPayload;

    if (
      payload.version !== 1 ||
      typeof payload.username !== "string" ||
      typeof payload.expiresAt !== "number" ||
      payload.expiresAt <= Date.now()
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function getAdminAuthStatus() {
  return readAdminConfig();
}

export async function isAdminAuthenticated() {
  const config = readAdminConfig();

  if (!config.ok) {
    return false;
  }

  const cookieStore = await cookies();
  const session = decodeSession(
    cookieStore.get(SESSION_COOKIE_NAME)?.value,
    config.authSecret
  );

  return session?.username === config.username;
}

export async function loginAdmin(username: string, password: string) {
  const config = readAdminConfig();

  if (!config.ok) {
    return { ok: false, reason: "config" as const };
  }

  const usernameMatches = safeCredentialEqual(
    username.trim(),
    config.username,
    config.authSecret
  );
  const passwordMatches = safeCredentialEqual(
    password,
    config.password,
    config.authSecret
  );

  if (!usernameMatches || !passwordMatches) {
    return { ok: false, reason: "invalid" as const };
  }

  const payload: SessionPayload = {
    version: 1,
    username: config.username,
    expiresAt: Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
  };
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE_NAME, encodeSession(payload, config.authSecret), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  return { ok: true };
}

export async function logoutAdmin() {
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}
