import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { getRuntimeBootstrap, type RuntimeBootstrap } from "./lib/runtimeMode.ts";
import projectsEntryRouter from "./routes/projects.entry.ts";

export interface CreatedApp {
  app: Express;
  runtime: Pick<RuntimeBootstrap, "mode">;
}

/**
 * Global error handler for Express
 * Catches errors from async route handlers and returns proper HTTP responses
 */
function createErrorHandler() {
  return (
    err: Error | unknown,
    _req: Request,
    res: Response,
    _next: NextFunction,
  ) => {
    const error = err instanceof Error ? err : new Error(String(err));
    const statusCode = (err as any)?.statusCode ?? 500;
    const message = error.message || "Internal Server Error";

    console.error(`[error] ${statusCode} ${message}`, error);

    if (res.headersSent) {
      return;
    }

    res.status(statusCode).json({
      error: message,
      status: statusCode,
    });
  };
}

export async function createApp(): Promise<CreatedApp> {
  const runtime = await getRuntimeBootstrap();
  const app: Express = express();
  const allowedOrigins = new Set(runtime.allowedOrigins);

  app.use(
    cors({
      credentials: true,
      origin(origin, callback) {
        // Allow non-browser clients and explicit trusted browser origins only.
        if (!origin || allowedOrigins.has(origin)) {
          callback(null, true);
          return;
        }

        callback(new Error(`Origin ${origin} is not allowed by CORS`));
      },
    }),
  );
  app.use(cookieParser());
  app.use("/api/billing/webhook", express.raw({ type: "application/json" }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use((_req, res, next) => {
    res.setHeader("x-hostack-runtime-mode", runtime.mode);
    next();
  });
  app.use(runtime.authMiddleware);
  app.get("/", (_req, res) => {
    res.status(200).send("ok");
  });
  app.get("/api/runtime", (_req, res) => {
    res.json({ mode: runtime.mode });
  });
  app.use("/api", projectsEntryRouter);
  app.use("/api", runtime.router);

  // Global error handler - must be last
  app.use(createErrorHandler());

  return {
    app,
    runtime: {
      mode: runtime.mode,
    },
  };
}
