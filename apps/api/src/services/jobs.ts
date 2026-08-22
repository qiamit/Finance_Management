import { Queue, Worker, type JobsOptions } from "bullmq";
import IORedis from "ioredis";
import { prisma } from "../lib/prisma";
import { parseCasPdf } from "./cas";
import { readFileBytes } from "./storage";
import { refreshHoldingPrices } from "./prices";
import { fetchAngelHoldings, parseStoredCredentials } from "./angelone";

let connection: IORedis | null = null;

function redisUrl() {
  return process.env.REDIS_URL || process.env.REDIS_PRIVATE_URL;
}

export function getRedis(): IORedis | null {
  const url = redisUrl();
  if (!url) return null;
  if (!connection) {
    connection = new IORedis(url, { maxRetriesPerRequest: null });
  }
  return connection;
}

export const QUEUE_NAME = "fm-jobs";

export type JobName = "parse-cas" | "refresh-prices" | "angel-sync";

export function jobsQueue(): Queue | null {
  const conn = getRedis();
  if (!conn) return null;
  return new Queue(QUEUE_NAME, { connection: conn });
}

export async function enqueue(name: JobName, data: Record<string, unknown>, opts?: JobsOptions) {
  const queue = jobsQueue();
  if (!queue) {
    await runJob(name, data);
    return;
  }
  await queue.add(name, data, opts);
}

export async function runJob(name: string, data: Record<string, unknown>) {
  if (name === "parse-cas") {
    const importId = String(data.importId);
    const password = data.password ? String(data.password) : undefined;
    const record = await prisma.casImport.findUnique({ where: { id: importId } });
    if (!record) return;
    await prisma.casImport.update({
      where: { id: importId },
      data: { status: "PARSING", error: null },
    });
    try {
      const bytes = await readFileBytes(record.fileKey);
      const parsed = await parseCasPdf(bytes, password);
      await prisma.casImport.update({
        where: { id: importId },
        data: { status: "READY_FOR_REVIEW", parsedJson: parsed as object },
      });
    } catch (error) {
      await prisma.casImport.update({
        where: { id: importId },
        data: { status: "FAILED", error: error instanceof Error ? error.message : "Parse failed" },
      });
    }
    return;
  }

  if (name === "refresh-prices") {
    await refreshHoldingPrices(data.familyId ? String(data.familyId) : undefined);
    return;
  }

  if (name === "angel-sync") {
    const connectionId = String(data.connectionId);
    const conn = await prisma.brokerConnection.findUnique({ where: { id: connectionId } });
    if (!conn) return;
    try {
      const creds = parseStoredCredentials(conn.credentialsEnc);
      const rows = await fetchAngelHoldings(creds);
      for (const row of rows) {
        const isin = row.isin || null;
        const name = row.tradingsymbol || "Equity";
        const quantity = Number(row.quantity || 0);
        const avgCost = Number(row.averageprice || 0);
        const currentPrice = Number(row.ltp || avgCost);
        if (!quantity) continue;
        const existing = isin
          ? await prisma.holding.findFirst({
              where: { memberId: conn.memberId, isin, assetType: "EQUITY" },
            })
          : await prisma.holding.findFirst({
              where: { memberId: conn.memberId, name, assetType: "EQUITY", source: "ANGEL_ONE" },
            });
        if (existing) {
          await prisma.holding.update({
            where: { id: existing.id },
            data: { quantity, avgCost, currentPrice, source: "ANGEL_ONE", symbol: name },
          });
        } else {
          await prisma.holding.create({
            data: {
              familyId: conn.familyId,
              memberId: conn.memberId,
              assetType: "EQUITY",
              name,
              symbol: name,
              isin,
              quantity,
              avgCost,
              currentPrice,
              source: "ANGEL_ONE",
            },
          });
        }
      }
      await prisma.brokerConnection.update({
        where: { id: connectionId },
        data: { lastSyncAt: new Date(), lastError: null },
      });
    } catch (error) {
      await prisma.brokerConnection.update({
        where: { id: connectionId },
        data: { lastError: error instanceof Error ? error.message : "Sync failed" },
      });
    }
  }
}

export function startWorker() {
  const conn = getRedis();
  if (!conn) {
    console.log("REDIS_URL missing — worker will idle; jobs run inline in the API");
    return null;
  }
  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      await runJob(job.name, job.data as Record<string, unknown>);
    },
    { connection: conn },
  );
  worker.on("failed", (job, err) => {
    console.error("Job failed", job?.name, err);
  });
  return worker;
}
