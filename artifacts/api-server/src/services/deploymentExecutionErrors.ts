export type DeploymentExecutionPhase =
  | "preparing"
  | "cloning"
  | "detecting"
  | "installing"
  | "building"
  | "packaging"
  | "deploying"
  | "verifying"
  | "simulating";

export type DeploymentExecutionErrorCode =
  | "execution_busy"
  | "database_unavailable"
  | "deployment_not_found"
  | "project_not_found"
  | "missing_repository"
  | "invalid_job_payload"
  | "unsupported_job_type"
  | "configuration_invalid"
  | "clone_failed"
  | "install_failed"
  | "build_failed"
  | "artifact_invalid"
  | "runtime_undetermined"
  | "deployment_activation_failed"
  | "deployment_verification_failed"
  | "simulation_failed"
  | "deployment_failed";

type DeploymentExecutionErrorOptions = {
  code: DeploymentExecutionErrorCode;
  message: string;
  retryable: boolean;
  phase?: DeploymentExecutionPhase;
  cause?: unknown;
};

const TRANSIENT_INFRASTRUCTURE_PATTERNS = [
  /\b429\b/,
  /\b5\d\d\b/,
  /\bECONN(?:RESET|REFUSED)\b/i,
  /\bEAI_AGAIN\b/i,
  /\bENOTFOUND\b/i,
  /\bETIMEDOUT\b/i,
  /\bTLS\b/i,
  /\bfetch failed\b/i,
  /\brate limit/i,
  /\btemporar(?:y|ily)\b/i,
  /\btimeout\b/i,
] as const;

const NON_RETRYABLE_CLONE_PATTERNS = [
  /\bAuthentication failed\b/i,
  /\bPermission denied\b/i,
  /\bRepository not found\b/i,
  /\bCould not read from remote repository\b/i,
  /\bnot found\b/i,
  /\baccess denied\b/i,
  /\b401\b/,
  /\b403\b/,
  /\b404\b/,
] as const;

const NON_RETRYABLE_COMMAND_PATTERNS = [
  /\bCommand '.*' is not available in this worker environment\b/i,
  /\bNode version mismatch\b/i,
  /\bBuild command is required\b/i,
  /\bNo package\.json found\b/i,
  /\bArtifact invalid\b/i,
  /\bCould not determine whether deployment should run\b/i,
  /\bnot found\b/i,
] as const;

export class DeploymentExecutionError extends Error {
  readonly code: DeploymentExecutionErrorCode;
  readonly retryable: boolean;
  readonly phase?: DeploymentExecutionPhase;

  constructor(options: DeploymentExecutionErrorOptions) {
    super(options.message);
    this.name = "DeploymentExecutionError";
    this.code = options.code;
    this.retryable = options.retryable;
    this.phase = options.phase;

    if (options.cause !== undefined) {
      Object.defineProperty(this, "cause", {
        value: options.cause,
        enumerable: false,
        configurable: true,
      });
    }
  }
}

export class DeploymentExecutionBusyError extends DeploymentExecutionError {
  constructor(readonly deploymentId: string) {
    super({
      code: "execution_busy",
      message: `Deployment ${deploymentId} is already being executed by another worker`,
      retryable: true,
    });
    this.name = "DeploymentExecutionBusyError";
  }
}

function matchesAnyPattern(message: string, patterns: readonly RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(message));
}

function normalizeMessage(error: unknown, fallbackMessage?: string): string {
  const rawMessage = error instanceof Error ? error.message : fallbackMessage ?? String(error);
  return rawMessage.replace(/\s+/g, " ").trim();
}

function isTransientInfrastructureError(message: string): boolean {
  return matchesAnyPattern(message, TRANSIENT_INFRASTRUCTURE_PATTERNS);
}

function classifyByPhase(
  phase: DeploymentExecutionPhase | undefined,
  message: string,
): Pick<DeploymentExecutionErrorOptions, "code" | "retryable" | "phase"> {
  switch (phase) {
    case "cloning":
      return {
        code: "clone_failed",
        retryable: !matchesAnyPattern(message, NON_RETRYABLE_CLONE_PATTERNS),
        phase,
      };
    case "installing":
      return {
        code: "install_failed",
        retryable:
          !matchesAnyPattern(message, NON_RETRYABLE_COMMAND_PATTERNS) &&
          isTransientInfrastructureError(message),
        phase,
      };
    case "building":
      return {
        code: "build_failed",
        retryable:
          !matchesAnyPattern(message, NON_RETRYABLE_COMMAND_PATTERNS) &&
          isTransientInfrastructureError(message),
        phase,
      };
    case "packaging":
      return {
        code: "artifact_invalid",
        retryable: false,
        phase,
      };
    case "deploying":
      return {
        code: "deployment_activation_failed",
        retryable: true,
        phase,
      };
    case "verifying":
      return {
        code: "deployment_verification_failed",
        retryable: true,
        phase,
      };
    case "simulating":
      return {
        code: "simulation_failed",
        retryable: true,
        phase,
      };
    case "preparing":
      return {
        code: "deployment_failed",
        retryable: isTransientInfrastructureError(message),
        phase,
      };
    case "detecting":
      return {
        code: "configuration_invalid",
        retryable: false,
        phase,
      };
    default:
      return {
        code: "deployment_failed",
        retryable: isTransientInfrastructureError(message),
        phase,
      };
  }
}

export function classifyDeploymentExecutionError(
  error: unknown,
  context: {
    phase?: DeploymentExecutionPhase;
    fallbackMessage?: string;
  } = {},
): DeploymentExecutionError {
  if (error instanceof DeploymentExecutionError) {
    return error;
  }

  const message = normalizeMessage(error, context.fallbackMessage);
  const classification = classifyByPhase(context.phase, message);

  return new DeploymentExecutionError({
    ...classification,
    message,
    cause: error,
  });
}
