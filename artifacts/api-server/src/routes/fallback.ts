import { Router, type IRouter, type Request, type Response } from "express";
import { CANONICAL_APP_URL } from "../lib/auth.js";
import { createSafeReturnToResolver } from "../lib/safeReturnTo.js";

const router: IRouter = Router();
const getSafeReturnTo = createSafeReturnToResolver(CANONICAL_APP_URL);

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

router.get("/login", (req: Request, res: Response) => {
  const returnTo = getSafeReturnTo(
    typeof req.query.returnTo === "string" ? req.query.returnTo : undefined,
  );
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
