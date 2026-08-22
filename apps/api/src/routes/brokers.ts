import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { assertCanWrite, requireAuth } from "../lib/auth";
import { encryptText } from "../lib/crypto";
import { enqueue } from "../services/jobs";

const connectSchema = z.object({
  memberId: z.string().min(1),
  apiKey: z.string().min(4),
  clientCode: z.string().min(2),
  totpSecret: z.string().min(8),
  pin: z.string().min(4).optional(),
  password: z.string().optional(),
});

export async function brokerRoutes(app: FastifyInstance) {
  app.get("/brokers", async (request) => {
    const auth = await requireAuth(request);
    const rows = await prisma.brokerConnection.findMany({
      where: { familyId: auth.familyId },
      include: { member: { select: { fullName: true } } },
    });
    return rows.map((row) => ({
      id: row.id,
      memberId: row.memberId,
      memberName: row.member.fullName,
      broker: row.broker,
      lastSyncAt: row.lastSyncAt,
      lastError: row.lastError,
      createdAt: row.createdAt,
    }));
  });

  app.post("/brokers/angel-one/connect", async (request, reply) => {
    const auth = await requireAuth(request);
    assertCanWrite(auth.role);
    const body = connectSchema.parse(request.body);
    const member = await prisma.familyMember.findFirst({
      where: { id: body.memberId, familyId: auth.familyId },
    });
    if (!member) return reply.code(400).send({ error: "Member not found" });
    const credentialsEnc = encryptText(
      JSON.stringify({
        apiKey: body.apiKey,
        clientCode: body.clientCode,
        totpSecret: body.totpSecret,
        pin: body.pin,
        password: body.password,
      }),
    );
    const row = await prisma.brokerConnection.upsert({
      where: { memberId_broker: { memberId: body.memberId, broker: "ANGEL_ONE" } },
      update: { credentialsEnc, lastError: null },
      create: {
        familyId: auth.familyId,
        memberId: body.memberId,
        broker: "ANGEL_ONE",
        credentialsEnc,
      },
    });
    return { id: row.id, memberId: row.memberId, broker: row.broker };
  });

  app.post("/brokers/angel-one/:id/sync", async (request, reply) => {
    const auth = await requireAuth(request);
    assertCanWrite(auth.role);
    const id = (request.params as { id: string }).id;
    const row = await prisma.brokerConnection.findFirst({
      where: { id, familyId: auth.familyId },
    });
    if (!row) return reply.code(404).send({ error: "Connection not found" });
    await enqueue("angel-sync", { connectionId: row.id });
    return { ok: true, status: "queued" };
  });

  app.delete("/brokers/:id", async (request, reply) => {
    const auth = await requireAuth(request);
    assertCanWrite(auth.role);
    const id = (request.params as { id: string }).id;
    const row = await prisma.brokerConnection.findFirst({
      where: { id, familyId: auth.familyId },
    });
    if (!row) return reply.code(404).send({ error: "Connection not found" });
    await prisma.brokerConnection.delete({ where: { id } });
    return { ok: true };
  });
}
