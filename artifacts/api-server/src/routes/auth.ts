import * as oidc from "openid-client";
import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { db, usersTable } from "@workspace/db";
import {
  clearSession,
  getOidcConfig,
  getSessionId,
  createSession,
  deleteSession,
  SESSION_COOKIE,
  SESSION_TTL,
  CANONICAL_APP_URL,
  CALLBACK_URL,
  COOKIE_SECURE,
  OIDC_ISSUER_URL,
  OIDC_CLIENT_ID,
  OIDC_AUDIENCE,
  OIDC_PROMPT,
  OIDC_SCOPE,
  type SessionData,
} from "../lib/auth.js";
import { createSafeReturnToResolver } from "../lib/safeReturnTo.js";

const OIDC_COOKIE_TTL = 10 * 60 * 1000;

const router: IRouter = Router();
const getSafeReturnTo = createSafeReturnToResolver(CANONICAL_APP_URL);

const MobileExchangeBody = z.object({
  code: z.string(),
  state: z.string(),
  codeVerifier: z.string(),
  nonce: z.string().optional(),
  redirectUri: z.string(),
});

/**
 * Wrapper to catch async errors in Express route handlers
 */
function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

function setSessionCookie(res: Response, sid: string) {
  res.cookie(SESSION_COOKIE, sid, {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL,
  });
}

function setOidcCookie(res: Response, name: string, value: string) {
  res.cookie(name, value, {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: "lax",
    path: "/",
    maxAge: OIDC_COOKIE_TTL,
  });
}

function getAuth0Domain(): string {
  const configured = process.env.AUTH0_DOMAIN?.trim();
  if (configured) {
    return configured.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  }

  return new URL(OIDC_ISSUER_URL).host;
}

function redirectToAuthError(req: Request, res: Response, reason: string) {
  const target = new URL(CANONICAL_APP_URL);
  target.searchParams.set("auth_error", reason);
  res.redirect(target.href);
}

async function upsertUser(claims: Record<string, unknown>) {
  const userData = {
    id: claims.sub as string,
    email: (claims.email as string) || null,
    firstName: (claims.first_name as string) || null,
    lastName: (claims.last_name as string) || null,
    profileImageUrl: (claims.profile_image_url || claims.picture) as string | null,
  };

  const [user] = await db
    .insert(usersTable)
    .values(userData)
    .onConflictDoUpdate({
      target: usersTable.id,
      set: {
        ...userData,
        updatedAt: new Date(),
      },
    })
    .returning();
  return user;
}

router.get("/auth/user", (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.json({ authenticated: false, isAuthenticated: false, user: null });
    return;
  }
  const u = req.user;
  res.json({
    authenticated: true,
    isAuthenticated: true,
    user: {
      id: u.id,
      email: u.email ?? undefined,
      firstName: u.firstName ?? undefined,
      lastName: u.lastName ?? undefined,
      profileImage: u.profileImage ?? undefined,
    },
  });
});

router.get("/login", asyncHandler(async (req: Request, res: Response) => {
  try {
    const config = await getOidcConfig();

    const returnTo = getSafeReturnTo(
      typeof req.query.returnTo === "string" ? req.query.returnTo : undefined,
    );

    const state = oidc.randomState();
    const nonce = oidc.randomNonce();
    const codeVerifier = oidc.randomPKCECodeVerifier();
    const codeChallenge = await oidc.calculatePKCECodeChallenge(codeVerifier);

    const authorizationParams: Record<string, string> = {
      redirect_uri: CALLBACK_URL,
      scope: OIDC_SCOPE,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      state,
      nonce,
    };
    if (OIDC_PROMPT) {
      authorizationParams.prompt = OIDC_PROMPT;
    }
    if (OIDC_AUDIENCE) {
      authorizationParams.audience = OIDC_AUDIENCE;
    }

    const redirectTo = oidc.buildAuthorizationUrl(config, authorizationParams);

    setOidcCookie(res, "code_verifier", codeVerifier);
    setOidcCookie(res, "nonce", nonce);
    setOidcCookie(res, "state", state);
    setOidcCookie(res, "return_to", returnTo);

    res.redirect(redirectTo.href);
  } catch (error) {
    console.error("Login error:", error);
    const target = new URL(CANONICAL_APP_URL);
    target.searchParams.set("auth_error", "login_failed");
    res.redirect(target.href);
  }
}));

router.get("/callback", asyncHandler(async (req: Request, res: Response) => {
  console.log("Auth callback hit");

  try {
    const config = await getOidcConfig();

    const codeVerifier = req.cookies?.code_verifier;
    const nonce = req.cookies?.nonce;
    const expectedState = req.cookies?.state;

    if (!codeVerifier || !expectedState) {
      redirectToAuthError(req, res, "missing_login_state");
      return;
    }

    const currentUrl = new URL(req.originalUrl || "/api/callback", `${CANONICAL_APP_URL}/`);
    currentUrl.pathname = "/api/callback";

    let tokens: oidc.TokenEndpointResponse & oidc.TokenEndpointResponseHelpers;
    try {
      tokens = await oidc.authorizationCodeGrant(config, currentUrl, {
        pkceCodeVerifier: codeVerifier,
        expectedNonce: nonce,
        expectedState,
        idTokenExpected: true,
      });
    } catch (error) {
      console.error("OIDC callback token exchange failed", error);
      redirectToAuthError(req, res, "token_exchange_failed");
      return;
    }

    const returnTo = getSafeReturnTo(
      typeof req.cookies?.return_to === "string" ? req.cookies.return_to : undefined,
    );

    res.clearCookie("code_verifier", { path: "/" });
    res.clearCookie("nonce", { path: "/" });
    res.clearCookie("state", { path: "/" });
    res.clearCookie("return_to", { path: "/" });

    const claims = tokens.claims();
    if (!claims) {
      redirectToAuthError(req, res, "missing_claims");
      return;
    }

    const dbUser = await upsertUser(claims as unknown as Record<string, unknown>);

    const now = Math.floor(Date.now() / 1000);
    const sessionData: SessionData = {
      user: {
        id: dbUser.id,
        email: dbUser.email,
        firstName: dbUser.firstName,
        lastName: dbUser.lastName,
        profileImage: dbUser.profileImageUrl,
      },
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: tokens.expiresIn() ? now + tokens.expiresIn()! : claims.exp,
    };

    const sid = await createSession(sessionData);
    setSessionCookie(res, sid);
    res.redirect(returnTo);
  } catch (error) {
    console.error("Callback error:", error);
    redirectToAuthError(req, res, "callback_failed");
  }
}));

router.get("/logout", asyncHandler(async (req: Request, res: Response) => {
  console.log("Logout triggered");

  try {
    const sid = getSessionId(req);
    await clearSession(res, sid);

    const logoutUrl = new URL(`https://${getAuth0Domain()}/v2/logout`);
    logoutUrl.searchParams.set("client_id", OIDC_CLIENT_ID);
    logoutUrl.searchParams.set("returnTo", CANONICAL_APP_URL);
    res.redirect(logoutUrl.href);
  } catch (error) {
    console.error("Logout error:", error);
    res.redirect(CANONICAL_APP_URL);
  }
}));

router.post("/mobile-auth/token-exchange", asyncHandler(async (req: Request, res: Response) => {
  const parsed = MobileExchangeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Missing or invalid required parameters" });
    return;
  }

  const { code, codeVerifier, redirectUri, state, nonce } = parsed.data;

  try {
    const config = await getOidcConfig();

    const callbackUrl = new URL(redirectUri);
    callbackUrl.searchParams.set("code", code);
    callbackUrl.searchParams.set("state", state);
    callbackUrl.searchParams.set("iss", OIDC_ISSUER_URL);

    const tokens = await oidc.authorizationCodeGrant(config, callbackUrl, {
      pkceCodeVerifier: codeVerifier,
      expectedNonce: nonce ?? undefined,
      expectedState: state,
      idTokenExpected: true,
    });

    const claims = tokens.claims();
    if (!claims) {
      res.status(401).json({ error: "No claims in ID token" });
      return;
    }

    const dbUser = await upsertUser(claims as unknown as Record<string, unknown>);

    const now = Math.floor(Date.now() / 1000);
    const sessionData: SessionData = {
      user: {
        id: dbUser.id,
        email: dbUser.email,
        firstName: dbUser.firstName,
        lastName: dbUser.lastName,
        profileImage: dbUser.profileImageUrl,
      },
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: tokens.expiresIn() ? now + tokens.expiresIn()! : claims.exp,
    };

    const sid = await createSession(sessionData);
    res.json({ sessionToken: sid });
  } catch (err) {
    console.error("Mobile token exchange error:", err);
    res.status(500).json({ error: "Token exchange failed" });
  }
}));

router.post("/mobile-auth/logout", asyncHandler(async (req: Request, res: Response) => {
  try {
    const sid = getSessionId(req);
    if (sid) {
      await deleteSession(sid);
    }
    res.json({ success: true });
  } catch (error) {
    console.error("Mobile logout error:", error);
    res.json({ success: true });
  }
}));

export default router;
