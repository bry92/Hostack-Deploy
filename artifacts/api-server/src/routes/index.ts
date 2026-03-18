import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import projectsRouter from "./projects.js";
import deploymentsRouter from "./deployments.js";
import envVarsRouter from "./envVars.js";
import dashboardRouter from "./dashboard.js";
import profileRouter from "./profile.js";
import githubRouter from "./github.js";
import integrationsRouter from "./integrations.js";
import observabilityRouter from "./observability.js";
import sshKeysRouter from "./sshKeys.js";
import customDomainsRouter from "./customDomains.js";
import copilotRouter from "./copilot.js";
import notificationsRouter from "./notifications.js";
import buildRulesRouter from "./buildRules.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(projectsRouter);
router.use(deploymentsRouter);
router.use(envVarsRouter);
router.use(dashboardRouter);
router.use(profileRouter);
router.use(githubRouter);
router.use(integrationsRouter);
router.use(observabilityRouter);
router.use(sshKeysRouter);
router.use(customDomainsRouter);
router.use(copilotRouter);
router.use(notificationsRouter);
router.use(buildRulesRouter);

export default router;
