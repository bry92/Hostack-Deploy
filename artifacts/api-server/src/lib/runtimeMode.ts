import type { NextFunction, Request, Response, Router } from "express";
import { RUNTIME_MODE, IS_FALLBACK } from "../../../../lib/runtime-mode/src/index.ts";

export interface RuntimeBootstrap {
  allowedOrigins: string[];
  authMiddleware: (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => void | Promise<void>;
  mode: "full" | "fallback";
  router: Router;
}

function getAllowedOrigins() {
  const appUrl = (process.env.APP_URL ?? "http://localhost:3000")
    .trim()
    .replace(/\/+$/, "");

  const configured = process.env.CORS_ALLOWED_ORIGINS;
  if (!configured) {
    return [appUrl];
  }

  return configured
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

async function createFallbackBootstrap(): Promise<RuntimeBootstrap> {
  const [{ default: router }] = await Promise.all([
    import("../routes/fallback.ts"),
  ]);

  const authMiddleware: RuntimeBootstrap["authMiddleware"] = (req, _res, next) => {
    req.isAuthenticated = function isAuthenticated(this: Request) {
      return this.user != null;
    } as Request["isAuthenticated"];
    next();
  };

  return {
    allowedOrigins: getAllowedOrigins(),
    authMiddleware,
    mode: "fallback",
    router,
  };
}

async function createFullBootstrap(): Promise<RuntimeBootstrap> {
  const [{ authMiddleware }, { default: router }, authLib] = await Promise.all([
    import("../middlewares/authMiddleware.js"),
    import("../routes/index.js"),
    import("./auth.js"),
  ]);

  return {
    allowedOrigins: authLib.getAllowedCorsOrigins(),
    authMiddleware,
    mode: "full",
    router,
  };
}

export async function getRuntimeBootstrap(): Promise<RuntimeBootstrap> {
  return IS_FALLBACK ? createFallbackBootstrap() : createFullBootstrap();
}

export { RUNTIME_MODE, IS_FALLBACK };
