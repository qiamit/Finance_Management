import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import { authRoutes } from "./routes/auth";
import { familyRoutes } from "./routes/families";
import { memberRoutes } from "./routes/members";
import { holdingRoutes } from "./routes/holdings";
import { planRoutes } from "./routes/plans";
import { netWorthRoutes } from "./routes/networth";
import { importRoutes } from "./routes/imports";
import { brokerRoutes } from "./routes/brokers";
import { aiRoutes } from "./routes/ai";
import { prisma } from "./lib/prisma";

async function build() {
  const app = Fastify({ logger: true });
  const origins = (process.env.WEB_ORIGIN || "http://localhost:5173")
    .split(",")
    .map((s) => s.trim());

  await app.register(cors, {
    origin: origins,
    credentials: true,
  });
  await app.register(cookie);
  await app.register(multipart, { limits: { fileSize: 20 * 1024 * 1024 } });

  app.get("/health", async () => ({ ok: true, service: "api" }));

  app.setErrorHandler((error: unknown, _request, reply) => {
    const err = error as { statusCode?: number; name?: string; message?: string };
    const status = err.statusCode || 500;
    const message =
      err.name === "ZodError"
        ? "Invalid request"
        : err.message || "Server error";
    if (status >= 500) app.log.error(error);
    reply.code(status >= 400 ? status : 400).send({ error: message });
  });

  await app.register(authRoutes);
  await app.register(familyRoutes);
  await app.register(memberRoutes);
  await app.register(holdingRoutes);
  await app.register(planRoutes);
  await app.register(netWorthRoutes);
  await app.register(importRoutes);
  await app.register(brokerRoutes);
  await app.register(aiRoutes);

  return app;
}

async function start() {
  const app = await build();
  const port = Number(process.env.PORT || 3001);
  await app.listen({ port, host: "0.0.0.0" });
}

start().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
