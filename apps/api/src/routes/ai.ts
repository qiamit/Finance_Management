import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../lib/auth";
import { num } from "../lib/serialize";
import { analyzePortfolio, type SnapshotHolding } from "../services/gemini";

const analyzeSchema = z.object({
  memberId: z.string().optional(),
});

export async function aiRoutes(app: FastifyInstance) {
  app.get("/ai/insights", async (request) => {
    const auth = await requireAuth(request);
    return prisma.aiInsight.findMany({
      where: { familyId: auth.familyId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
  });

  app.post("/ai/analyze", async (request) => {
    const auth = await requireAuth(request);
    const body = analyzeSchema.parse(request.body ?? {});
    const holdings = await prisma.holding.findMany({
      where: { familyId: auth.familyId, memberId: body.memberId || undefined },
    });
    const snapshot: SnapshotHolding[] = holdings.map((h) => ({
      assetType: h.assetType,
      name: h.name,
      value: num(h.quantity) * num(h.currentPrice),
      invested: num(h.quantity) * num(h.avgCost),
    }));
    const content = await analyzePortfolio(snapshot);
    const saved = await prisma.aiInsight.create({
      data: {
        familyId: auth.familyId,
        memberId: body.memberId || null,
        content: content as object,
      },
    });
    return saved;
  });
}
