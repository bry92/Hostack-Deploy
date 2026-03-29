import { db } from "@workspace/db";
import { deploymentLogsTable, deploymentsTable } from "@workspace/db/schema";
import { asc, eq } from "drizzle-orm";

export type DeploymentAiSummary = {
  explanation: string;
  suggestion: string;
};

const XAI_API_URL = "https://api.x.ai/v1/chat/completions";
const DEFAULT_XAI_MODEL = "grok-4-1-fast";
const MAX_LOG_CHARS = 12000;

const RULES: Array<{
  explanation: string;
  pattern: string;
  suggestion: string;
}> = [
  {
    pattern: "missing script",
    explanation: "Build script is missing",
    suggestion: "Add a build script to package.json",
  },
  {
    pattern: "cannot find module",
    explanation: "A dependency is missing",
    suggestion: "Run npm install or check dependencies",
  },
];

const FALLBACK_SUMMARY: DeploymentAiSummary = {
  explanation: "The deployment failed, but the logs do not match a known fast-path issue.",
  suggestion: "Review the first error in the deployment logs and retry after fixing the failing step.",
};

function normalizeLogs(logs: string): string {
  return logs.replace(/\0/g, "").trim();
}

function matchRule(logs: string): DeploymentAiSummary | null {
  const normalized = logs.toLowerCase();

  for (const rule of RULES) {
    if (normalized.includes(rule.pattern)) {
      return {
        explanation: rule.explanation,
        suggestion: rule.suggestion,
      };
    }
  }

  return null;
}

function trimLogsForModel(logs: string): string {
  if (logs.length <= MAX_LOG_CHARS) {
    return logs;
  }

  return logs.slice(-MAX_LOG_CHARS);
}

function parseModelSummary(content: string): DeploymentAiSummary | null {
  const trimmed = content.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed) as Partial<DeploymentAiSummary>;
    if (
      typeof parsed.explanation === "string" &&
      parsed.explanation.trim() &&
      typeof parsed.suggestion === "string" &&
      parsed.suggestion.trim()
    ) {
      return {
        explanation: parsed.explanation.trim(),
        suggestion: parsed.suggestion.trim(),
      };
    }
  } catch {
    // Fall through to permissive parsing.
  }

  const explanationMatch = trimmed.match(/"explanation"\s*:\s*"([^"]+)"/i);
  const suggestionMatch = trimmed.match(/"suggestion"\s*:\s*"([^"]+)"/i);
  if (explanationMatch?.[1] && suggestionMatch?.[1]) {
    return {
      explanation: explanationMatch[1].trim(),
      suggestion: suggestionMatch[1].trim(),
    };
  }

  return null;
}

async function analyzeWithXai(logs: string): Promise<DeploymentAiSummary> {
  const apiKey = process.env.XAI_API_KEY?.trim();
  if (!apiKey) {
    return FALLBACK_SUMMARY;
  }

  try {
    const response = await fetch(XAI_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.XAI_MODEL?.trim() || DEFAULT_XAI_MODEL,
        stream: false,
        temperature: 0,
        messages: [
          {
            role: "system",
            content:
              "You analyze failed deployment logs. Respond with JSON only: {\"explanation\": string, \"suggestion\": string}. Keep both concise and actionable.",
          },
          {
            role: "user",
            content: `Analyze these deployment logs and explain the most likely root cause.\n\n${trimLogsForModel(logs)}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || `xAI responded with ${response.status}`);
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content ?? "";
    return parseModelSummary(content) ?? FALLBACK_SUMMARY;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[deployment-ai] xAI analysis failed: ${message}`);
    return FALLBACK_SUMMARY;
  }
}

export async function analyzeDeploymentLogs(logs: string): Promise<DeploymentAiSummary> {
  const normalizedLogs = normalizeLogs(logs);
  const ruleMatch = matchRule(normalizedLogs);
  if (ruleMatch) {
    return ruleMatch;
  }

  return analyzeWithXai(normalizedLogs);
}

export async function generateAndStoreDeploymentAiSummary(
  deploymentId: string,
): Promise<DeploymentAiSummary | null> {
  const logs = await db
    .select({
      logLevel: deploymentLogsTable.logLevel,
      message: deploymentLogsTable.message,
    })
    .from(deploymentLogsTable)
    .where(eq(deploymentLogsTable.deploymentId, deploymentId))
    .orderBy(asc(deploymentLogsTable.stepOrder), asc(deploymentLogsTable.createdAt));

  const logText = logs
    .map((entry) => `[${entry.logLevel}] ${entry.message}`)
    .join("\n")
    .trim();

  if (!logText) {
    try {
      await db
        .update(deploymentsTable)
        .set({ aiSummary: FALLBACK_SUMMARY })
        .where(eq(deploymentsTable.id, deploymentId));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[notion] metadata persist skipped: ${message}`);
    }
    return FALLBACK_SUMMARY;
  }

  const summary = await analyzeDeploymentLogs(logText);
  try {
    await db
      .update(deploymentsTable)
      .set({ aiSummary: summary })
      .where(eq(deploymentsTable.id, deploymentId));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[notion] metadata persist skipped: ${message}`);
  }

  return summary;
}
