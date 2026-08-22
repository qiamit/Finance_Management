import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ASSET_TYPES, type AssetType } from "@fm/shared";
import { prisma } from "../lib/prisma";
import { assertCanWrite, requireAuth } from "../lib/auth";
import { storeFile } from "../services/storage";
import { enqueue } from "../services/jobs";
import { refreshHoldingPrices } from "../services/prices";
import type { ParseResult, ProposedHolding } from "../services/cas";

const confirmSchema = z.object({
  holdings: z.array(
    z.object({
      assetType: z.enum(ASSET_TYPES),
      name: z.string().min(1),
      isin: z.string().optional().nullable(),
      folio: z.string().optional().nullable(),
      symbol: z.string().optional().nullable(),
      quantity: z.number().positive(),
      avgCost: z.number().min(0),
      currentPrice: z.number().min(0),
    }),
  ),
});

export async function importRoutes(app: FastifyInstance) {
  app.get("/imports/cas", async (request) => {
    const auth = await requireAuth(request);
    return prisma.casImport.findMany({
      where: { familyId: auth.familyId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  });

  app.post("/imports/cas", async (request, reply) => {
    const auth = await requireAuth(request);
    assertCanWrite(auth.role);
    const file = await request.file();
    if (!file) return reply.code(400).send({ error: "PDF file is required" });
    const memberId = fieldString(file.fields.memberId);
    const password = fieldString(file.fields.password);
    if (!memberId) return reply.code(400).send({ error: "memberId is required" });
    const member = await prisma.familyMember.findFirst({
      where: { id: memberId, familyId: auth.familyId },
    });
    if (!member) return reply.code(400).send({ error: "Member not found" });

    const buffer = await file.toBuffer();
    const key = await storeFile(buffer, file.filename || "cas.pdf", file.mimetype);
    const record = await prisma.casImport.create({
      data: {
        familyId: auth.familyId,
        memberId,
        fileKey: key,
        status: "UPLOADED",
      },
    });
    await enqueue("parse-cas", { importId: record.id, password: password || undefined });
    return record;
  });

  app.get("/imports/cas/:id", async (request, reply) => {
    const auth = await requireAuth(request);
    const id = (request.params as { id: string }).id;
    const record = await prisma.casImport.findFirst({
      where: { id, familyId: auth.familyId },
    });
    if (!record) return reply.code(404).send({ error: "Import not found" });
    return record;
  });

  app.post("/imports/cas/:id/confirm", async (request, reply) => {
    const auth = await requireAuth(request);
    assertCanWrite(auth.role);
    const id = (request.params as { id: string }).id;
    const record = await prisma.casImport.findFirst({
      where: { id, familyId: auth.familyId },
    });
    if (!record) return reply.code(404).send({ error: "Import not found" });
    if (record.status !== "READY_FOR_REVIEW") {
      return reply.code(400).send({ error: "Import is not ready for review" });
    }
    const body = confirmSchema.parse(request.body);
    const created = [];
    for (const item of body.holdings) {
      const existing = item.isin
        ? await prisma.holding.findFirst({
            where: { memberId: record.memberId, isin: item.isin },
          })
        : null;
      if (existing) {
        const holding = await prisma.holding.update({
          where: { id: existing.id },
          data: {
            name: item.name,
            quantity: item.quantity,
            avgCost: item.avgCost,
            currentPrice: item.currentPrice,
            folio: item.folio || existing.folio,
            symbol: item.symbol || existing.symbol,
            source: "CAS",
          },
        });
        created.push(holding);
      } else {
        const holding = await prisma.holding.create({
          data: {
            familyId: auth.familyId,
            memberId: record.memberId,
            assetType: item.assetType as AssetType,
            name: item.name,
            isin: item.isin || null,
            folio: item.folio || null,
            symbol: item.symbol || null,
            quantity: item.quantity,
            avgCost: item.avgCost,
            currentPrice: item.currentPrice,
            source: "CAS",
          },
        });
        created.push(holding);
      }
    }
    await prisma.casImport.update({
      where: { id },
      data: { status: "CONFIRMED" },
    });
    await enqueue("refresh-prices", { familyId: auth.familyId });
    return { imported: created.length };
  });

  app.post("/prices/refresh", async (request) => {
    const auth = await requireAuth(request);
    assertCanWrite(auth.role);
    const result = await refreshHoldingPrices(auth.familyId);
    return result;
  });
}

function fieldString(field: unknown): string {
  if (!field) return "";
  const value = Array.isArray(field) ? field[0] : field;
  if (value && typeof value === "object" && "value" in value) {
    return String((value as { value: unknown }).value || "");
  }
  return String(value || "");
}

export function proposedFromImport(record: { parsedJson: unknown }): ProposedHolding[] {
  const parsed = record.parsedJson as ParseResult | null;
  return parsed?.holdings || [];
}
