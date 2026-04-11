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
  GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET,
  GITHUB_CALLBACK_URL,
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

/**
 * Get available auth providers
 */
router.get("/auth/providers", (req: Request, res: Response) => {
  const providers: Array<{
    name: string;
    id: string;
    enabled: boolean;
    loginUrl: string;
  }> = [];

  // Auth0/OIDC provider (always available unless explicitly disabled)
  if (OIDC_CLIENT_ID) {
    providers.push({
      name: "Auth0",
      id: "auth0",
      enabled: true,
      loginUrl: "/api/login",
    });
  }

  // GitHub provider
  if (GITHUB_CLIENT_ID) {
    providers.push({
      name: "GitHub",
      id: "github",
      enabled: true,
      loginUrl: "/api/github-login",
    });
  }

  res.json({ providers });
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

/**
 * GitHub OAuth Login
 * Initiates GitHub OAuth flow
 */
router.get("/github-login", asyncHandler(async (req: Request, res: Response) => {
  try {
    if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET || !GITHUB_CALLBACK_URL) {
      res.status(400).json({ error: "GitHub OAuth not configured" });
      return;
    }

    const returnTo = getSafeReturnTo(
      typeof req.query.returnTo === "string" ? req.query.returnTo : undefined,
    );

    const state = oidc.randomState();
    const githubAuthUrl = new URL("https://github.com/login/oauth/authorize");
    githubAuthUrl.searchParams.set("client_id", GITHUB_CLIENT_ID);
    githubAuthUrl.searchParams.set("redirect_uri", GITHUB_CALLBACK_URL);
    githubAuthUrl.searchParams.set("scope", "user:email");
    githubAuthUrl.searchParams.set("state", state);
    githubAuthUrl.searchParams.set("allow_signup", "true");

    // Store state and returnTo for callback validation
    setOidcCookie(res, "github_state", state);
    setOidcCookie(res, "return_to", returnTo);

    res.redirect(githubAuthUrl.href);
  } catch (error) {
    console.error("GitHub login error:", error);
    const target = new URL(CANONICAL_APP_URL);
    target.searchParams.set("auth_error", "github_login_failed");
    res.redirect(target.href);
  }
}));

/**
 * GitHub OAuth Callback
 * Handles GitHub OAuth callback and creates session
 */
router.get("/github-callback", asyncHandler(async (req: Request, res: Response) => {
  try {
    if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET || !GITHUB_CALLBACK_URL) {
      redirectToAuthError(req, res, "github_not_configured");
      return;
    }

    const code = req.query.code as string;
    const state = req.query.state as string;
    const storedState = req.cookies?.github_state;

    if (!code || !state || state !== storedState) {
      console.error("GitHub OAuth state mismatch or missing code", { code, state, storedState });
      redirectToAuthError(req, res, "github_state_mismatch");
      return;
    }

    // Exchange code for access token
    const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: GITHUB_CALLBACK_URL,
        state,
      }),
    });

    const tokenData = await tokenResponse.json() as Record<string, unknown>;

    if (!tokenResponse.ok || "error" in tokenData) {
      console.error("GitHub token exchange failed", tokenData);
      redirectToAuthError(req, res, "github_token_failed");
      return;
    }

    const accessToken = tokenData.access_token as string | undefined;
    if (!accessToken) {
      redirectToAuthError(req, res, "github_no_token");
      return;
    }

    // Fetch user info from GitHub
    const userResponse = await fetch("https://api.github.com/user", {
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Accept": "application/vnd.github.v3+json",
      },
    });

    const githubUser = await userResponse.json() as Record<string, unknown>;

    if (!userResponse.ok || typeof githubUser.id !== "number") {
      console.error("Failed to fetch GitHub user", githubUser);
      redirectToAuthError(req, res, "github_user_fetch_failed");
      return;
    }

    // Fetch user email from GitHub
    let email: string | null = null;
    if (typeof githubUser.email === "string" && githubUser.email) {
      email = githubUser.email;
    } else {
      // If no primary email, fetch from emails endpoint
      const emailResponse = await fetch("https://api.github.com/user/emails", {
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Accept": "application/vnd.github.v3+json",
        },
      });

      if (emailResponse.ok) {
        const emails = await emailResponse.json() as Array<{ email: string; primary: boolean }>;
        const primaryEmail = emails.find((e) => e.primary);
        email = primaryEmail?.email || emails[0]?.email || null;
      }
    }

    // Create or update user
    const userId = `github_${githubUser.id}`;
    const userData = {
      id: userId,
      email: email,
      firstName: (typeof githubUser.name === "string" ? githubUser.name.split(" ")[0] : null) || null,
      lastName: (typeof githubUser.name === "string" && githubUser.name.includes(" ") 
        ? githubUser.name.split(" ").slice(1).join(" ") 
        : null) || null,
      profileImageUrl: (typeof githubUser.avatar_url === "string" ? githubUser.avatar_url : null) || null,
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

    // Create session
    const now = Math.floor(Date.now() / 1000);
    const sessionData: SessionData = {
      user: {
        id: user.id,
        email: user.email ?? undefined,
        firstName: user.firstName ?? undefined,
        lastName: user.lastName ?? undefined,
        profileImage: user.profileImageUrl ?? undefined,
      },
      access_token: accessToken,
      expires_at: now + 3600, // GitHub tokens expire in 1 hour
    };

    const sid = await createSession(sessionData);
    setSessionCookie(res, sid);

    // Clear temporary cookies
    res.clearCookie("github_state", { path: "/" });
    res.clearCookie("return_to", { path: "/" });

    const returnTo = getSafeReturnTo(
      typeof req.cookies?.return_to === "string" ? req.cookies.return_to : undefined,
    );

    res.redirect(returnTo);
  } catch (error) {
    console.error("GitHub callback error:", error);
    redirectToAuthError(req, res, "github_callback_failed");
  }
}));

export default router;
