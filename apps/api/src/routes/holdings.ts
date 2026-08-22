import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ASSET_TYPES } from "@fm/shared";
import { prisma } from "../lib/prisma";
import { assertCanWrite, requireAuth } from "../lib/auth";
import { serializeHolding } from "../lib/serialize";
import { applyQuoteToHolding } from "../services/prices";

const holdingSchema = z.object({
  memberId: z.string().min(1),
  assetType: z.enum(ASSET_TYPES),
  name: z.string().min(1),
  symbol: z.string().optional().nullable(),
  isin: z.string().optional().nullable(),
  folio: z.string().optional().nullable(),
  quantity: z.number().positive(),
  avgCost: z.number().min(0),
  currentPrice: z.number().min(0),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
});

async function assertMember(familyId: string, memberId: string) {
  const member = await prisma.familyMember.findFirst({ where: { id: memberId, familyId } });
  if (!member) {
    const err = new Error("Member not found in this family");
    (err as Error & { statusCode?: number }).statusCode = 400;
    throw err;
  }
}

export async function holdingRoutes(app: FastifyInstance) {
  app.get("/holdings", async (request) => {
    const auth = await requireAuth(request);
    const q = request.query as { memberId?: string };
    const holdings = await prisma.holding.findMany({
      where: { familyId: auth.familyId, memberId: q.memberId || undefined },
      include: { member: { select: { fullName: true } } },
      orderBy: { createdAt: "desc" },
    });
    return holdings.map(serializeHolding);
  });

  app.post("/holdings", async (request) => {
    const auth = await requireAuth(request);
    assertCanWrite(auth.role);
    const body = holdingSchema.parse(request.body);
    await assertMember(auth.familyId, body.memberId);
    const holding = await prisma.holding.create({
      data: {
        familyId: auth.familyId,
        memberId: body.memberId,
        assetType: body.assetType,
        name: body.name,
        symbol: body.symbol || null,
        isin: body.isin || null,
        folio: body.folio || null,
        quantity: body.quantity,
        avgCost: body.avgCost,
        currentPrice: body.currentPrice,
        metadata: body.metadata ? (body.metadata as object) : undefined,
        source: "MANUAL",
      },
      include: { member: { select: { fullName: true } } },
    });
    await applyQuoteToHolding(holding.id).catch(() => undefined);
    const fresh = await prisma.holding.findUniqueOrThrow({
      where: { id: holding.id },
      include: { member: { select: { fullName: true } } },
    });
    return serializeHolding(fresh);
  });

  app.get("/holdings/:id", async (request, reply) => {
    const auth = await requireAuth(request);
    const id = (request.params as { id: string }).id;
    const holding = await prisma.holding.findFirst({
      where: { id, familyId: auth.familyId },
      include: { member: { select: { fullName: true } } },
    });
    if (!holding) return reply.code(404).send({ error: "Holding not found" });
    return serializeHolding(holding);
  });

  app.patch("/holdings/:id", async (request, reply) => {
    const auth = await requireAuth(request);
    assertCanWrite(auth.role);
    const id = (request.params as { id: string }).id;
    const existing = await prisma.holding.findFirst({ where: { id, familyId: auth.familyId } });
    if (!existing) return reply.code(404).send({ error: "Holding not found" });
    const body = holdingSchema.partial().parse(request.body);
    if (body.memberId) await assertMember(auth.familyId, body.memberId);
    const holding = await prisma.holding.update({
      where: { id },
      data: {
        memberId: body.memberId,
        assetType: body.assetType,
        name: body.name,
        symbol: body.symbol,
        isin: body.isin,
        folio: body.folio,
        quantity: body.quantity,
        avgCost: body.avgCost,
        currentPrice: body.currentPrice,
        metadata: body.metadata === undefined ? undefined : (body.metadata as object | undefined),
      },
      include: { member: { select: { fullName: true } } },
    });
    return serializeHolding(holding);
  });

  app.delete("/holdings/:id", async (request, reply) => {
    const auth = await requireAuth(request);
    assertCanWrite(auth.role);
    const id = (request.params as { id: string }).id;
    const existing = await prisma.holding.findFirst({ where: { id, familyId: auth.familyId } });
    if (!existing) return reply.code(404).send({ error: "Holding not found" });
    await prisma.holding.delete({ where: { id } });
    return { ok: true };
  });
}
