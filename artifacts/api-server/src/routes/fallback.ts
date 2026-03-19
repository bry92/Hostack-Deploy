import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();

function getSafeReturnTo(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }
  return value;
}

router.get(["/health", "/healthz"], (_req: Request, res: Response) => {
  res.json({
    mode: "fallback",
    ok: true,
    status: "ok",
  });
});

router.get("/auth/user", (_req: Request, res: Response) => {
  res.json({
    authenticated: false,
    fallback: true,
    isAuthenticated: false,
    mode: "fallback",
    user: null,
  });
});

router.get("/test", (_req: Request, res: Response) => {
  res.json({ message: "fallback API alive" });
});

router.get("/db/ping", async (_req: Request, res: Response) => {
  try {
    const { pingDatabase } = await import("@workspace/db");
    await pingDatabase();
    res.json({ db: "ok" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ db: "error", message });
  }
});

router.get("/login", (req: Request, res: Response) => {
  const returnTo = getSafeReturnTo(req.query.returnTo);
  res.redirect(returnTo);
});

router.get("/callback", (_req: Request, res: Response) => {
  res.redirect("/");
});

router.get("/logout", (_req: Request, res: Response) => {
  res.redirect("/");
});

router.use((req: Request, res: Response) => {
  res.status(503).json({
    error: `Route ${req.method} ${req.originalUrl} is unavailable in fallback mode`,
    mode: "fallback",
  });
});

export default router;
