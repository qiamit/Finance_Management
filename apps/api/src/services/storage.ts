import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

function s3Enabled() {
  return Boolean(process.env.S3_ENDPOINT && process.env.S3_ACCESS_KEY_ID && process.env.S3_BUCKET);
}

function client() {
  return new S3Client({
    region: process.env.S3_REGION || "auto",
    endpoint: process.env.S3_ENDPOINT,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
    },
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== "false",
  });
}

const localDir = path.join(process.cwd(), "uploads");

export async function storeFile(bytes: Buffer, filename: string, contentType: string): Promise<string> {
  const key = `cas/${randomUUID()}-${filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  if (s3Enabled()) {
    await client().send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: key,
        Body: bytes,
        ContentType: contentType,
      }),
    );
    return key;
  }
  await mkdir(path.join(localDir, "cas"), { recursive: true });
  await writeFile(path.join(process.cwd(), "uploads", key), bytes);
  return key;
}

export async function readFileBytes(key: string): Promise<Buffer> {
  if (s3Enabled()) {
    const result = await client().send(
      new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }),
    );
    const stream = result.Body;
    if (!stream) throw new Error("Empty object");
    const chunks: Buffer[] = [];
    for await (const chunk of stream as AsyncIterable<Uint8Array>) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
  return readFile(path.join(process.cwd(), "uploads", key));
}

export async function deleteFile(key: string): Promise<void> {
  if (s3Enabled()) {
    await client().send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }));
  }
}
