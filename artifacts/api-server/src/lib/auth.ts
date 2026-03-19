import * as client from "openid-client";
import crypto from "crypto";
import { type Request, type Response } from "express";
import { db, sessionsTable } from "@workspace/db";
import { IS_FALLBACK } from "../../../../lib/runtime-mode/src/index.ts";
import { eq } from "drizzle-orm";
import type { AuthUser } from "@workspace/api-zod";

function getEnv(...names: string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name];
    if (value) return value;
  }
  return undefined;
}

function requireEnv(primaryName: string, ...fallbackNames: string[]): string {
  const value = getEnv(primaryName, ...fallbackNames);
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${[primaryName, ...fallbackNames].join(" or ")}`,
    );
  }
  return value;
}

function normalizeIssuerUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function normalizeAppUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

function getClientAuth(): client.ClientAuth | undefined {
  if (!OIDC_CLIENT_SECRET) return undefined;

  switch (OIDC_CLIENT_AUTH_METHOD) {
    case "client_secret_post":
      return client.ClientSecretPost(OIDC_CLIENT_SECRET);
    case "client_secret_basic":
    default:
      return client.ClientSecretBasic(OIDC_CLIENT_SECRET);
  }
}

export const OIDC_ISSUER_URL = normalizeIssuerUrl(
  IS_FALLBACK
    ? process.env.OIDC_ISSUER_URL ?? process.env.AUTH0_DOMAIN ?? "https://dev-fallback.auth0.local"
    : requireEnv("OIDC_ISSUER_URL", "AUTH0_DOMAIN"),
);
export const APP_URL = normalizeAppUrl(
  IS_FALLBACK ? process.env.APP_URL ?? "http://localhost:3000" : requireEnv("APP_URL"),
);
export const OIDC_CLIENT_ID = IS_FALLBACK
  ? process.env.OIDC_CLIENT_ID ?? process.env.AUTH0_CLIENT_ID ?? "dev-fallback-client-id"
  : requireEnv("OIDC_CLIENT_ID", "AUTH0_CLIENT_ID");
export const OIDC_CLIENT_SECRET = getEnv(
  "OIDC_CLIENT_SECRET",
  "AUTH0_CLIENT_SECRET",
) ?? (IS_FALLBACK ? "dev-fallback-client-secret" : undefined);
export const OIDC_CLIENT_AUTH_METHOD =
  getEnv("OIDC_CLIENT_AUTH_METHOD") ?? "client_secret_basic";
export const OIDC_SCOPE =
  getEnv("OIDC_SCOPE", "AUTH0_SCOPE") ?? "openid profile email offline_access";
export const OIDC_AUDIENCE = getEnv("OIDC_AUDIENCE", "AUTH0_AUDIENCE");
export const OIDC_PROMPT = getEnv("OIDC_PROMPT", "AUTH0_PROMPT");
export const SESSION_COOKIE = "sid";
export const SESSION_TTL = 7 * 24 * 60 * 60 * 1000;
export const COOKIE_SECURE = new URL(APP_URL).protocol === "https:";

export function getAllowedCorsOrigins(): string[] {
  const configured = getEnv("CORS_ALLOWED_ORIGINS");
  if (!configured) return [APP_URL];

  return configured
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export interface SessionData {
  user: AuthUser;
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
}

let oidcConfig: client.Configuration | null = null;
const fallbackSessions = new Map<string, SessionData & { expireAt: number }>();

export async function getOidcConfig(): Promise<client.Configuration> {
  if (IS_FALLBACK) {
    return {} as client.Configuration;
  }

  if (!oidcConfig) {
    oidcConfig = await client.discovery(
      new URL(OIDC_ISSUER_URL),
      OIDC_CLIENT_ID,
      undefined,
      getClientAuth(),
    );
  }
  return oidcConfig;
}

export async function createSession(data: SessionData): Promise<string> {
  const sid = crypto.randomBytes(32).toString("hex");

  if (IS_FALLBACK) {
    fallbackSessions.set(sid, {
      ...data,
      expireAt: Date.now() + SESSION_TTL,
    });
    return sid;
  }

  await db.insert(sessionsTable).values({
    sid,
    sess: data as unknown as Record<string, unknown>,
    expire: new Date(Date.now() + SESSION_TTL),
  });
  return sid;
}

export async function getSession(sid: string): Promise<SessionData | null> {
  if (IS_FALLBACK) {
    const session = fallbackSessions.get(sid);
    if (!session || session.expireAt <= Date.now()) {
      fallbackSessions.delete(sid);
      return null;
    }

    return {
      access_token: session.access_token,
      expires_at: session.expires_at,
      refresh_token: session.refresh_token,
      user: session.user,
    };
  }

  const [row] = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.sid, sid));

  if (!row || row.expire < new Date()) {
    if (row) await deleteSession(sid);
    return null;
  }

  return row.sess as unknown as SessionData;
}

export async function updateSession(
  sid: string,
  data: SessionData,
): Promise<void> {
  if (IS_FALLBACK) {
    fallbackSessions.set(sid, {
      ...data,
      expireAt: Date.now() + SESSION_TTL,
    });
    return;
  }

  await db
    .update(sessionsTable)
    .set({
      sess: data as unknown as Record<string, unknown>,
      expire: new Date(Date.now() + SESSION_TTL),
    })
    .where(eq(sessionsTable.sid, sid));
}

export async function deleteSession(sid: string): Promise<void> {
  if (IS_FALLBACK) {
    fallbackSessions.delete(sid);
    return;
  }

  await db.delete(sessionsTable).where(eq(sessionsTable.sid, sid));
}

export async function clearSession(
  res: Response,
  sid?: string,
): Promise<void> {
  if (sid) await deleteSession(sid);
  res.clearCookie(SESSION_COOKIE, { path: "/" });
}

export function getSessionId(req: Request): string | undefined {
  const authHeader = req.headers["authorization"];
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  return req.cookies?.[SESSION_COOKIE];
}
