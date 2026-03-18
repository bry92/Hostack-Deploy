import { db } from "@workspace/db";
import { projectNotificationSettingsTable, projectsTable, deploymentsTable, integrationsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { APP_URL } from "../lib/auth.js";
import { decryptMetadata } from "../lib/secrets.js";

type DeployEvent = "deploy_started" | "deploy_succeeded" | "deploy_failed";

interface NotificationPayload {
  event: DeployEvent;
  project: {
    id: string;
    name: string;
    slug: string;
  };
  deployment: {
    id: string;
    status: string;
    branch: string;
    commitHash: string | null;
    commitMessage: string | null;
    durationSeconds: number | null;
    deploymentUrl: string | null;
    detailUrl: string;
    environment: string;
  };
  timestamp: string;
}

function buildSlackPayload(payload: NotificationPayload): object {
  const statusEmoji =
    payload.event === "deploy_succeeded" ? ":white_check_mark:" :
    payload.event === "deploy_failed" ? ":x:" : ":rocket:";

  const statusText =
    payload.event === "deploy_succeeded" ? "succeeded" :
    payload.event === "deploy_failed" ? "failed" : "started";

  const fields = [
    { title: "Project", value: payload.project.name, short: true },
    { title: "Status", value: statusText, short: true },
    { title: "Branch", value: payload.deployment.branch || "main", short: true },
    { title: "Environment", value: payload.deployment.environment, short: true },
  ];

  if (payload.deployment.commitHash) {
    fields.push({ title: "Commit", value: payload.deployment.commitHash.slice(0, 8), short: true });
  }
  if (payload.deployment.durationSeconds != null) {
    fields.push({ title: "Duration", value: `${payload.deployment.durationSeconds}s`, short: true });
  }

  const text = `${statusEmoji} Deploy ${statusText}: *${payload.project.name}*`;

  const actions = [];
  if (payload.deployment.detailUrl) {
    actions.push({ type: "button", text: "View Details", url: payload.deployment.detailUrl });
  }
  if (payload.deployment.deploymentUrl) {
    actions.push({ type: "button", text: "Visit Site", url: payload.deployment.deploymentUrl });
  }

  return {
    text,
    attachments: [
      {
        color: payload.event === "deploy_succeeded" ? "#36a64f" : payload.event === "deploy_failed" ? "#cc0000" : "#3498db",
        fields,
        ...(actions.length > 0 ? { actions } : {}),
      },
    ],
  };
}

function buildDiscordPayload(payload: NotificationPayload): object {
  const statusText =
    payload.event === "deploy_succeeded" ? "succeeded" :
    payload.event === "deploy_failed" ? "failed" : "started";

  const color =
    payload.event === "deploy_succeeded" ? 0x36a64f :
    payload.event === "deploy_failed" ? 0xcc0000 : 0x3498db;

  const fields = [
    { name: "Project", value: payload.project.name, inline: true },
    { name: "Status", value: statusText, inline: true },
    { name: "Branch", value: payload.deployment.branch || "main", inline: true },
    { name: "Environment", value: payload.deployment.environment, inline: true },
  ];

  if (payload.deployment.commitHash) {
    fields.push({ name: "Commit", value: `\`${payload.deployment.commitHash.slice(0, 8)}\``, inline: true });
  }
  if (payload.deployment.durationSeconds != null) {
    fields.push({ name: "Duration", value: `${payload.deployment.durationSeconds}s`, inline: true });
  }

  return {
    embeds: [
      {
        title: `Deploy ${statusText}: ${payload.project.name}`,
        color,
        fields,
        url: payload.deployment.detailUrl || payload.deployment.deploymentUrl || undefined,
        timestamp: payload.timestamp,
      },
    ],
  };
}

function buildGenericWebhookPayload(payload: NotificationPayload): object {
  return payload;
}

async function resolveWebhookUrl(
  setting: typeof projectNotificationSettingsTable.$inferSelect,
  userId: string,
): Promise<string | null> {
  if (setting.channelType === "webhook") {
    return setting.webhookUrl || null;
  }

  if (setting.channelType === "slack" || setting.channelType === "discord") {
    const integrations = await db
      .select()
      .from(integrationsTable)
      .where(
        and(
          eq(integrationsTable.userId, userId),
          eq(integrationsTable.provider, setting.channelType),
          eq(integrationsTable.status, "connected"),
        ),
      );

    if (integrations.length === 0) return null;

    const metadata = decryptMetadata(
      integrations[0].metadata as Record<string, unknown> | null,
    );
    if (!metadata) return null;

    const url = (metadata.webhookUrl || metadata.webhook_url || metadata.incomingWebhookUrl) as string | undefined;
    return url || null;
  }

  return null;
}


const ALLOWED_PORTS = new Set([443]);

const ALLOWED_PROVIDER_DOMAINS: Record<string, string[]> = {
  slack: ["hooks.slack.com"],
  discord: ["discord.com", "discordapp.com"],
};

function isPrivateIP(ip: string): boolean {
  if (ip === "127.0.0.1" || ip === "0.0.0.0" || ip === "::1" || ip === "::") return true;

  const parts = ip.split(".").map(Number);
  if (parts.length === 4 && parts.every(p => !isNaN(p))) {
    if (parts[0] === 10) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true;
    if (parts[0] === 0) return true;
    if (parts[0] >= 224) return true;
  }

  if (ip.startsWith("fc") || ip.startsWith("fd")) return true;
  if (ip.startsWith("fe80")) return true;
  if (ip.startsWith("::ffff:")) {
    const mapped = ip.slice(7);
    return isPrivateIP(mapped);
  }

  return false;
}

export function validateWebhookUrl(url: string): { valid: boolean; error?: string } {
  try {
    const parsed = new URL(url);

    if (parsed.protocol !== "https:") {
      return { valid: false, error: "Webhook URL must use HTTPS" };
    }

    const port = parsed.port ? parseInt(parsed.port, 10) : 443;
    if (!ALLOWED_PORTS.has(port)) {
      return { valid: false, error: "Webhook URL must use port 443" };
    }

    const hostname = parsed.hostname.toLowerCase();

    if (
      hostname === "localhost" ||
      hostname.endsWith(".local") ||
      hostname.endsWith(".internal") ||
      hostname.endsWith(".localhost") ||
      isPrivateIP(hostname)
    ) {
      return { valid: false, error: "Webhook URL must not point to a private/internal address" };
    }

    return { valid: true };
  } catch {
    return { valid: false, error: "Invalid URL format" };
  }
}

async function resolveAndValidateDNS(hostname: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const dns = await import("dns");
    const { resolve4, resolve6 } = dns.promises;

    const results: string[] = [];
    try {
      const ipv4 = await resolve4(hostname);
      results.push(...ipv4);
    } catch {}
    try {
      const ipv6 = await resolve6(hostname);
      results.push(...ipv6);
    } catch {}

    if (results.length === 0) {
      return { valid: false, error: "Could not resolve webhook hostname" };
    }

    for (const ip of results) {
      if (isPrivateIP(ip)) {
        return { valid: false, error: "Webhook URL resolves to a private/internal IP address" };
      }
    }

    return { valid: true };
  } catch {
    return { valid: false, error: "DNS resolution failed for webhook hostname" };
  }
}

export function validateProviderDomain(url: string, channelType: string): { valid: boolean; error?: string } {
  const allowedDomains = ALLOWED_PROVIDER_DOMAINS[channelType];
  if (!allowedDomains) return { valid: true };

  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    if (!allowedDomains.some(d => hostname === d || hostname.endsWith(`.${d}`))) {
      return { valid: false, error: `${channelType} webhook URL must be on ${allowedDomains.join(" or ")}` };
    }
    return { valid: true };
  } catch {
    return { valid: false, error: "Invalid URL format" };
  }
}

async function sendWebhook(url: string, body: object, channelType?: string): Promise<boolean> {
  const validation = validateWebhookUrl(url);
  if (!validation.valid) {
    console.error(`Notification webhook blocked: ${validation.error}`);
    return false;
  }

  if (channelType) {
    const providerCheck = validateProviderDomain(url, channelType);
    if (!providerCheck.valid) {
      console.error(`Notification webhook blocked: ${providerCheck.error}`);
      return false;
    }
  }

  const parsed = new URL(url);
  const dnsCheck = await resolveAndValidateDNS(parsed.hostname);
  if (!dnsCheck.valid) {
    console.error(`Notification webhook blocked: ${dnsCheck.error}`);
    return false;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!resp.ok) {
      console.error(`Notification webhook failed: ${resp.status} ${resp.statusText}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`Notification webhook error:`, err);
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

export async function dispatchDeployNotification(
  deploymentId: string,
  event: DeployEvent,
): Promise<void> {
  try {
    const [deployment] = await db
      .select()
      .from(deploymentsTable)
      .where(eq(deploymentsTable.id, deploymentId));

    if (!deployment) return;

    const [project] = await db
      .select()
      .from(projectsTable)
      .where(eq(projectsTable.id, deployment.projectId));

    if (!project) return;

    const settings = await db
      .select()
      .from(projectNotificationSettingsTable)
      .where(
        and(
          eq(projectNotificationSettingsTable.projectId, deployment.projectId),
          eq(projectNotificationSettingsTable.enabled, true),
        ),
      );

    if (settings.length === 0) return;

    const detailUrl = `${APP_URL}/projects/${project.id}/deployments/${deployment.id}`;

    const payload: NotificationPayload = {
      event,
      project: {
        id: project.id,
        name: project.name,
        slug: project.slug,
      },
      deployment: {
        id: deployment.id,
        status: deployment.status,
        branch: deployment.branch || "main",
        commitHash: deployment.commitHash,
        commitMessage: deployment.commitMessage,
        durationSeconds: deployment.durationSeconds,
        deploymentUrl: deployment.deploymentUrl,
        detailUrl,
        environment: deployment.environment,
      },
      timestamp: new Date().toISOString(),
    };

    for (const setting of settings) {
      const eventTypes = (setting.eventTypes as string[]) || [];
      if (!eventTypes.includes(event)) continue;

      const webhookUrl = await resolveWebhookUrl(setting, project.userId);
      if (!webhookUrl) continue;

      let body: object;
      switch (setting.channelType) {
        case "slack":
          body = buildSlackPayload(payload);
          break;
        case "discord":
          body = buildDiscordPayload(payload);
          break;
        default:
          body = buildGenericWebhookPayload(payload);
          break;
      }

      sendWebhook(webhookUrl, body, setting.channelType).catch(() => {});
    }
  } catch (err) {
    console.error("Failed to dispatch deploy notification:", err);
  }
}

export async function sendTestNotification(
  projectId: string,
  userId: string,
): Promise<{ success: boolean; error?: string }> {
  const settings = await db
    .select()
    .from(projectNotificationSettingsTable)
    .where(
      and(
        eq(projectNotificationSettingsTable.projectId, projectId),
        eq(projectNotificationSettingsTable.enabled, true),
      ),
    );

  if (settings.length === 0) {
    return { success: false, error: "No enabled notification channels configured" };
  }

  const [project] = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.id, projectId));

  if (!project) {
    return { success: false, error: "Project not found" };
  }

  const payload: NotificationPayload = {
    event: "deploy_succeeded",
    project: {
      id: project.id,
      name: project.name,
      slug: project.slug,
    },
    deployment: {
      id: "test-notification-id",
      status: "ready",
      branch: "main",
      commitHash: "abc1234567890",
      commitMessage: "Test notification from Hostack",
      durationSeconds: 42,
      deploymentUrl: `https://${project.slug}.hostack.app`,
      detailUrl: `${APP_URL}/projects/${project.id}/deployments/test-notification-id`,
      environment: "production",
    },
    timestamp: new Date().toISOString(),
  };

  let sentCount = 0;
  const errors: string[] = [];

  for (const setting of settings) {
    const webhookUrl = await resolveWebhookUrl(setting, userId);
    if (!webhookUrl) {
      errors.push(`No webhook URL found for ${setting.channelType} channel`);
      continue;
    }

    const urlValidation = validateWebhookUrl(webhookUrl);
    if (!urlValidation.valid) {
      errors.push(`${setting.channelType}: ${urlValidation.error}`);
      continue;
    }

    let body: object;
    switch (setting.channelType) {
      case "slack":
        body = buildSlackPayload(payload);
        break;
      case "discord":
        body = buildDiscordPayload(payload);
        break;
      default:
        body = buildGenericWebhookPayload(payload);
        break;
    }

    const delivered = await sendWebhook(webhookUrl, body, setting.channelType);
    if (delivered) {
      sentCount++;
    } else {
      errors.push(`${setting.channelType}: delivery failed`);
    }
  }

  if (sentCount > 0) {
    return { success: true };
  }
  return { success: false, error: errors.join("; ") };
}
