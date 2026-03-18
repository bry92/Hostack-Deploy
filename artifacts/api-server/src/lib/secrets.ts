import crypto from "crypto";

const ENCRYPTED_PREFIX = "enc:v1:";
const SENSITIVE_METADATA_KEYS = [
  "token",
  "secret",
  "key",
  "password",
  "apiKey",
  "accessKeyId",
  "secretAccessKey",
  "webhookUrl",
];

let warnedMissingKey = false;

function getEncryptionKey(): Buffer | null {
  const raw = process.env["SECRET_ENCRYPTION_KEY"]?.trim();
  if (!raw) return null;

  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }

  try {
    const decoded = Buffer.from(raw, "base64");
    if (decoded.length === 32) return decoded;
  } catch {
    // Fall through to explicit error below.
  }

  throw new Error(
    "SECRET_ENCRYPTION_KEY must be 32 bytes encoded as base64 or 64 hex characters.",
  );
}

function getRequiredEncryptionKey(): Buffer | null {
  const key = getEncryptionKey();
  if (key) return key;

  if (!warnedMissingKey && process.env["NODE_ENV"] !== "test") {
    warnedMissingKey = true;
    console.warn(
      "[secrets] SECRET_ENCRYPTION_KEY is not set; sensitive values will be stored in plaintext.",
    );
  }

  return null;
}

function isEncryptedValue(value: string): boolean {
  return value.startsWith(ENCRYPTED_PREFIX);
}

export function encryptString(value: string | null | undefined): string | null | undefined {
  if (value == null || value === "") return value;
  if (isEncryptedValue(value)) return value;

  const key = getRequiredEncryptionKey();
  if (!key) return value;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${ENCRYPTED_PREFIX}${Buffer.concat([iv, tag, ciphertext]).toString("base64")}`;
}

export function decryptString(value: string | null | undefined): string | null | undefined {
  if (value == null || value === "" || !isEncryptedValue(value)) return value;

  const key = getEncryptionKey();
  if (!key) {
    throw new Error("SECRET_ENCRYPTION_KEY is required to decrypt stored secrets.");
  }

  const payload = Buffer.from(value.slice(ENCRYPTED_PREFIX.length), "base64");
  const iv = payload.subarray(0, 12);
  const tag = payload.subarray(12, 28);
  const ciphertext = payload.subarray(28);

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

function isSensitiveMetadataKey(key: string): boolean {
  const lower = key.toLowerCase();
  return SENSITIVE_METADATA_KEYS.some((fragment) => lower.includes(fragment.toLowerCase()));
}

export function encryptMetadata(
  metadata: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  if (!metadata) return {};

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (typeof value === "string" && isSensitiveMetadataKey(key)) {
      result[key] = encryptString(value);
    } else {
      result[key] = value;
    }
  }

  return result;
}

export function decryptMetadata(
  metadata: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  if (!metadata) return {};

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (typeof value === "string" && isSensitiveMetadataKey(key)) {
      result[key] = decryptString(value);
    } else {
      result[key] = value;
    }
  }

  return result;
}

