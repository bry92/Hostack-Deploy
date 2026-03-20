import path from "node:path";
import { z } from "zod";

const repoRelativePathMessage =
  "Must be repo-relative and must not use absolute paths or '..' traversal";

const projectTypes = [
  "auto",
  "static",
  "node",
  "next",
  "react-vite",
  "wordpress-static",
  "n8n",
] as const;

const packageManagers = ["auto", "npm", "pnpm", "yarn"] as const;
const runtimes = ["auto", "static", "node"] as const;

const staticProjectTypes = new Set(["static", "react-vite", "wordpress-static"]);
const nodeProjectTypes = new Set(["node", "next", "n8n"]);

const nonEmptyString = z.string().trim().min(1);

export const HostackProjectTypeSchema = z.enum(projectTypes);
export const HostackPackageManagerSchema = z.enum(packageManagers);
export const HostackRuntimeSchema = z.enum(runtimes);

export function normalizeRepoRelativePath(value: string): string {
  const normalized = value.trim().replace(/\\/g, "/").replace(/\/+/g, "/");
  const withoutLeadingDots = normalized.replace(/^(\.\/)+/, "");
  const withoutTrailingSlash = withoutLeadingDots.replace(/\/$/, "");
  return withoutTrailingSlash || ".";
}

function isRepoRelativePath(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }

  if (path.posix.isAbsolute(trimmed) || path.win32.isAbsolute(trimmed)) {
    return false;
  }

  const normalized = normalizeRepoRelativePath(trimmed);
  return !normalized.split("/").some((segment) => segment === "..");
}

const RepoRelativePathSchema = nonEmptyString.refine(isRepoRelativePath, {
  message: repoRelativePathMessage,
});

const EnvNameSchema = z
  .string()
  .regex(/^[A-Za-z_][A-Za-z0-9_]*$/, "Must be a shell-safe environment variable name");

const EnvRecordSchema = z.record(EnvNameSchema, z.string());

const BuildSchema = z
  .object({
    packageManager: HostackPackageManagerSchema.optional(),
    runtime: HostackRuntimeSchema.optional(),
    builderImage: nonEmptyString.optional(),
    install: nonEmptyString.optional(),
    build: nonEmptyString.optional(),
    start: nonEmptyString.optional(),
    env: EnvRecordSchema.optional(),
    envFromProject: z.array(EnvNameSchema).optional(),
  })
  .strict()
  .superRefine((build, ctx) => {
    if (!build.envFromProject) {
      return;
    }

    const seen = new Set<string>();
    for (const [index, envName] of build.envFromProject.entries()) {
      if (seen.has(envName)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["envFromProject", index],
          message: `Duplicate envFromProject entry '${envName}'`,
        });
      }
      seen.add(envName);
    }
  });

const DeploySchema = z
  .object({
    output: RepoRelativePathSchema.optional(),
    port: z.number().int().min(1).max(65535).optional(),
    healthCheckPath: z.string().startsWith("/").optional(),
  })
  .strict();

const WordpressSchema = z
  .object({
    wpContentPath: RepoRelativePathSchema.optional(),
    contentPath: RepoRelativePathSchema.optional(),
    crawlBaseUrl: z.string().url().optional(),
  })
  .strict();

const N8nSchema = z
  .object({
    workflowsPath: RepoRelativePathSchema.optional(),
    useGitDiff: z.boolean().optional(),
    externalize: z.boolean().optional(),
  })
  .strict();

const baseProjectShape = {
  name: nonEmptyString,
  path: RepoRelativePathSchema.optional(),
  build: BuildSchema.optional(),
  deploy: DeploySchema.optional(),
};

const AutoProjectSchema = z
  .object({
    ...baseProjectShape,
    type: z.literal("auto"),
  })
  .strict();

const StaticProjectSchema = z
  .object({
    ...baseProjectShape,
    type: z.literal("static"),
  })
  .strict();

const NodeProjectSchema = z
  .object({
    ...baseProjectShape,
    type: z.literal("node"),
  })
  .strict();

const NextProjectSchema = z
  .object({
    ...baseProjectShape,
    type: z.literal("next"),
  })
  .strict();

const ReactViteProjectSchema = z
  .object({
    ...baseProjectShape,
    type: z.literal("react-vite"),
  })
  .strict();

const WordpressProjectSchema = z
  .object({
    ...baseProjectShape,
    type: z.literal("wordpress-static"),
    wordpress: WordpressSchema.optional(),
  })
  .strict();

const N8nProjectSchema = z
  .object({
    ...baseProjectShape,
    type: z.literal("n8n"),
    n8n: N8nSchema.optional(),
  })
  .strict();

export const HostackProjectSchema = z.discriminatedUnion("type", [
  AutoProjectSchema,
  StaticProjectSchema,
  NodeProjectSchema,
  NextProjectSchema,
  ReactViteProjectSchema,
  WordpressProjectSchema,
  N8nProjectSchema,
]);

export const HostackConfigFileSchema = z
  .object({
    version: z.literal("1"),
    projects: z.array(HostackProjectSchema).min(1),
  })
  .strict()
  .superRefine((config, ctx) => {
    const seenNames = new Set<string>();
    const seenPaths = new Set<string>();

    for (const [index, project] of config.projects.entries()) {
      if (seenNames.has(project.name)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["projects", index, "name"],
          message: `Duplicate project name '${project.name}'`,
        });
      }
      seenNames.add(project.name);

      const normalizedPath = normalizeRepoRelativePath(project.path ?? ".");
      if (seenPaths.has(normalizedPath)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["projects", index, "path"],
          message: `Duplicate project path '${normalizedPath}'`,
        });
      }
      seenPaths.add(normalizedPath);

      if (project.build?.runtime === "static" && project.build.start) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["projects", index, "build", "start"],
          message: "Static runtimes cannot define a start command",
        });
      }

      if (staticProjectTypes.has(project.type)) {
        if (project.build?.runtime && project.build.runtime !== "static") {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["projects", index, "build", "runtime"],
            message: `${project.type} projects must resolve to the static runtime`,
          });
        }

        if (project.build?.start) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["projects", index, "build", "start"],
            message: `${project.type} projects cannot define a start command`,
          });
        }
      }

      if (nodeProjectTypes.has(project.type) && project.build?.runtime === "static") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["projects", index, "build", "runtime"],
          message: `${project.type} projects cannot resolve to the static runtime`,
        });
      }
    }
  });

const ResolvedWordpressSchema = z
  .object({
    wpContentPath: RepoRelativePathSchema,
    contentPath: RepoRelativePathSchema,
    crawlBaseUrl: z.string().url(),
  })
  .strict();

const ResolvedN8nSchema = z
  .object({
    workflowsPath: RepoRelativePathSchema,
    useGitDiff: z.boolean(),
    externalize: z.boolean(),
  })
  .strict();

export const ResolvedHostackProjectSchema = z
  .object({
    name: nonEmptyString,
    path: RepoRelativePathSchema,
    type: HostackProjectTypeSchema,
    packageManager: HostackPackageManagerSchema,
    runtime: HostackRuntimeSchema,
    builderImage: nonEmptyString.nullable(),
    install: nonEmptyString.nullable(),
    build: nonEmptyString.nullable(),
    start: nonEmptyString.nullable(),
    output: RepoRelativePathSchema.nullable(),
    port: z.number().int().min(1).max(65535).nullable(),
    healthCheckPath: z.string().startsWith("/").nullable(),
    env: EnvRecordSchema,
    envFromProject: z.array(EnvNameSchema),
    wordpress: ResolvedWordpressSchema.nullable(),
    n8n: ResolvedN8nSchema.nullable(),
  })
  .strict()
  .superRefine((project, ctx) => {
    if (project.runtime === "static" && project.start) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["start"],
        message: "Static runtimes cannot define a start command",
      });
    }
  });

export const ResolvedHostackConfigSchema = z
  .object({
    version: z.literal("1"),
    projects: z.array(ResolvedHostackProjectSchema).min(1),
  })
  .strict();

export type HostackConfigFile = z.infer<typeof HostackConfigFileSchema>;
export type HostackProject = z.infer<typeof HostackProjectSchema>;
export type ResolvedHostackConfig = z.infer<typeof ResolvedHostackConfigSchema>;
export type ResolvedHostackProject = z.infer<typeof ResolvedHostackProjectSchema>;
