import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { getRuntimeBootstrap, type RuntimeBootstrap } from "./lib/runtimeMode.ts";
import projectsEntryRouter from "./routes/projects.entry.ts";

export interface CreatedApp {
  app: Express;
  runtime: Pick<RuntimeBootstrap, "mode">;
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

  return {
    app,
    runtime: {
      mode: runtime.mode,
    },
  };
}
