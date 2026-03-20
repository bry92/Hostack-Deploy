import { access, readFile } from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import {
  type HostackConfigFile,
  HostackConfigFileSchema,
  type ResolvedHostackConfig,
} from "./schema.js";
import { resolveHostackConfig } from "./resolve.js";

const defaultConfigNames = ["hostack.yaml", "hostack.yml"] as const;

export function parseHostackConfigText(sourceText: string): HostackConfigFile {
  const parsed = YAML.parse(sourceText);
  return HostackConfigFileSchema.parse(parsed);
}

export async function loadHostackConfig(configPath: string): Promise<HostackConfigFile> {
  const sourceText = await readFile(configPath, "utf8");
  return parseHostackConfigText(sourceText);
}

export async function loadResolvedHostackConfig(configPath: string): Promise<ResolvedHostackConfig> {
  return resolveHostackConfig(await loadHostackConfig(configPath));
}

export async function findHostackConfigPath(repoRoot: string): Promise<string | null> {
  for (const filename of defaultConfigNames) {
    const candidate = path.join(repoRoot, filename);

    try {
      await access(candidate);
      return candidate;
    } catch {
      continue;
    }
  }

  return null;
}

export async function loadHostackConfigFromRepo(repoRoot: string): Promise<HostackConfigFile | null> {
  const configPath = await findHostackConfigPath(repoRoot);
  if (!configPath) {
    return null;
  }

  return loadHostackConfig(configPath);
}

export async function loadResolvedHostackConfigFromRepo(
  repoRoot: string,
): Promise<ResolvedHostackConfig | null> {
  const configPath = await findHostackConfigPath(repoRoot);
  if (!configPath) {
    return null;
  }

  return loadResolvedHostackConfig(configPath);
}
