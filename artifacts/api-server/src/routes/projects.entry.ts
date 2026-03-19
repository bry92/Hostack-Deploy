import { Router, type IRouter, type NextFunction, type Request, type Response } from "express";
import { IS_FALLBACK } from "../lib/runtimeMode.ts";

const router: IRouter = Router();

router.get("/projects", async (req: Request, res: Response, next: NextFunction) => {
  if (IS_FALLBACK) {
    res.json([
      { id: "fallback-1", name: "Fallback Project" },
    ]);
    return;
  }

  try {
    const { default: fullProjectsRouter } = await import("./projects.js");
    fullProjectsRouter(req, res, next);
  } catch (error) {
    next(error);
  }
});

export default router;
