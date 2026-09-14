import { createHash } from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  getPrisma: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: mocks.cookies,
  headers: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ getPrisma: mocks.getPrisma }));

import { getDiferenciasSessionUser } from "./diferencias-auth";

const token = "a".repeat(43);
const tokenHash = createHash("sha256").update(token).digest("hex");
const activeUser = {
  avatarUrl: null,
  createdAt: new Date("2025-01-01T00:00:00.000Z"),
  displayName: "Active user",
  id: "user-1",
  isActive: true,
  username: "active-user",
};

function setCookie(value?: string) {
  mocks.cookies.mockResolvedValue({
    get: vi.fn(() => (value ? { value } : undefined)),
  });
}

function setSession(session: unknown) {
  const deleteSession = vi.fn().mockResolvedValue(undefined);
  const findUnique = vi.fn().mockResolvedValue(session);
  mocks.getPrisma.mockReturnValue({
    diferenciasSession: { delete: deleteSession, findUnique },
  });
  return { deleteSession, findUnique };
}

describe("getDiferenciasSessionUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("denies a request without a session", async () => {
    setCookie();

    await expect(getDiferenciasSessionUser()).resolves.toBeNull();
    expect(mocks.getPrisma).not.toHaveBeenCalled();
  });

  it("denies a malformed or forged session", async () => {
    setCookie("forged");
    await expect(getDiferenciasSessionUser()).resolves.toBeNull();
    expect(mocks.getPrisma).not.toHaveBeenCalled();

    setCookie(token);
    const { findUnique } = setSession(null);
    await expect(getDiferenciasSessionUser()).resolves.toBeNull();
    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tokenHash } })
    );
  });

  it("returns the user for a valid, unexpired active session", async () => {
    setCookie(token);
    setSession({
      expiresAt: new Date(Date.now() + 60_000),
      id: "session-1",
      user: activeUser,
    });

    await expect(getDiferenciasSessionUser()).resolves.toEqual(activeUser);
  });

  it.each([
    {
      label: "expired",
      session: {
        expiresAt: new Date(0),
        id: "expired-session",
        user: activeUser,
      },
    },
    {
      label: "deactivated",
      session: {
        expiresAt: new Date(Date.now() + 60_000),
        id: "inactive-session",
        user: { ...activeUser, isActive: false },
      },
    },
    {
      label: "orphaned",
      session: {
        expiresAt: new Date(Date.now() + 60_000),
        id: "orphaned-session",
        user: null,
      },
    },
  ])("denies and cleans up a $label session", async ({ session }) => {
    setCookie(token);
    const { deleteSession } = setSession(session);

    await expect(getDiferenciasSessionUser()).resolves.toBeNull();
    expect(deleteSession).toHaveBeenCalledWith({
      where: { id: session.id },
    });
  });
});
