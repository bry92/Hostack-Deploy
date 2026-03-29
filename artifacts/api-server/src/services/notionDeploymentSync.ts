import { db } from "@workspace/db";
import { deploymentsTable, projectsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

export type NotionDeploymentStatus = "pending" | "building" | "success" | "failed";

function getNotionApiKey(): string | null {
  return process.env.NOTION_API_KEY?.trim() || null;
}

function mapDeploymentStatusToNotionStatus(status: string | null | undefined): NotionDeploymentStatus {
  switch (status) {
    case "ready":
    case "deployed":
      return "success";
    case "failed":
      return "failed";
    case "building":
    case "deploying":
      return "building";
    default:
      return "pending";
  }
}

function toRichText(content: string | null | undefined) {
  const normalized = content?.trim();
  if (!normalized) {
    return [];
  }

  return [
    {
      text: {
        content: normalized.slice(0, 2000),
      },
    },
  ];
}

function formatAiSummary(summary: {
  explanation: string;
  suggestion: string;
} | null | undefined): string {
  if (!summary) {
    return "";
  }

  return `Explanation: ${summary.explanation}\nSuggestion: ${summary.suggestion}`;
}

export async function updateNotionPage(data: {
  aiSummary: string;
  deploymentId?: string | null;
  pageId: string;
  previewUrl: string | null;
  repoUrl?: string | null;
  status: NotionDeploymentStatus;
}): Promise<void> {
  const notionApiKey = getNotionApiKey();
  if (!notionApiKey) {
    return;
  }

  const response = await fetch(`https://api.notion.com/v1/pages/${data.pageId}`, {
    method: "PATCH",
    headers: {
      "Authorization": `Bearer ${notionApiKey}`,
      "Content-Type": "application/json",
      "Notion-Version": "2022-06-28",
    },
    body: JSON.stringify({
      properties: {
        "AI Summary": {
          rich_text: toRichText(data.aiSummary),
        },
        "Deployment ID": {
          rich_text: toRichText(data.deploymentId),
        },
        "Preview URL": {
          url: data.previewUrl,
        },
        "Repo URL": {
          rich_text: toRichText(data.repoUrl),
        },
        "Status": {
          select: {
            name: data.status,
          },
        },
      },
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Notion responded with ${response.status}`);
  }
}

export async function syncDeploymentToNotion(
  deploymentId: string,
  options: {
    status?: NotionDeploymentStatus;
  } = {},
): Promise<void> {
  const [deployment] = await db
    .select({
      aiSummary: deploymentsTable.aiSummary,
      deploymentId: deploymentsTable.id,
      deploymentUrl: deploymentsTable.deploymentUrl,
      notionPageId: deploymentsTable.notionPageId,
      status: deploymentsTable.status,
      repoUrl: projectsTable.repoUrl,
    })
    .from(deploymentsTable)
    .innerJoin(projectsTable, eq(projectsTable.id, deploymentsTable.projectId))
    .where(eq(deploymentsTable.id, deploymentId));

  if (!deployment?.notionPageId) {
    return;
  }

  await updateNotionPage({
    aiSummary: formatAiSummary(deployment.aiSummary),
    deploymentId: deployment.deploymentId,
    pageId: deployment.notionPageId,
    previewUrl: deployment.deploymentUrl || null,
    repoUrl: deployment.repoUrl,
    status: options.status ?? mapDeploymentStatusToNotionStatus(deployment.status),
  });
}
