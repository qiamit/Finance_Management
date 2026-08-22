import "dotenv/config";
import { Queue } from "bullmq";
import { getRedis, QUEUE_NAME, startWorker } from "./services/jobs";

async function main() {
  const worker = startWorker();
  const redis = getRedis();
  if (redis) {
    const queue = new Queue(QUEUE_NAME, { connection: redis });
    await queue.add("refresh-prices", {}, { repeat: { pattern: "0 */15 * * 1-5" } });
    await queue.add("refresh-prices", { kind: "eod" }, { repeat: { pattern: "30 23 * * *" } });
    console.log("Worker started with price refresh schedules");
  }
  if (!worker) {
    setInterval(() => undefined, 60_000);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
