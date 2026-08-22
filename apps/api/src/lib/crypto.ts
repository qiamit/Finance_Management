import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

function encryptionKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY || "";
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }
  return scryptSync(raw || "dev-only-encryption-key", "finance-management", 32);
}

export function encryptText(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decryptText(payload: string): string {
  const buf = Buffer.from(payload, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

export function panLast4(pan: string): string {
  const cleaned = pan.replace(/\s+/g, "").toUpperCase();
  return cleaned.slice(-4);
}

export function maskPan(last4?: string | null): string | null {
  if (!last4) return null;
  return `XXXXX${last4}`;
}
