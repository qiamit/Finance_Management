import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../lib/auth";
import { num } from "../lib/serialize";

export async function netWorthRoutes(app: FastifyInstance) {
  app.get("/net-worth", async (request) => {
    const auth = await requireAuth(request);
    const q = request.query as { memberId?: string };
    const holdings = await prisma.holding.findMany({
      where: { familyId: auth.familyId, memberId: q.memberId || undefined },
      include: { member: { select: { id: true, fullName: true, relation: true } } },
    });

    const rows = holdings.map((h) => {
      const quantity = num(h.quantity);
      const avgCost = num(h.avgCost);
      const currentPrice = num(h.currentPrice);
      const invested = quantity * avgCost;
      const value = quantity * currentPrice;
      return {
        holdingId: h.id,
        memberId: h.memberId,
        memberName: h.member.fullName,
        assetType: h.assetType,
        name: h.name,
        invested,
        value,
        pnl: value - invested,
      };
    });

    const totalValue = rows.reduce((s, r) => s + r.value, 0);
    const totalInvested = rows.reduce((s, r) => s + r.invested, 0);

    const byMemberMap = new Map<string, { memberId: string; memberName: string; value: number; invested: number }>();
    const byTypeMap = new Map<string, { assetType: string; value: number; invested: number }>();
    for (const row of rows) {
      const member = byMemberMap.get(row.memberId) || {
        memberId: row.memberId,
        memberName: row.memberName,
        value: 0,
        invested: 0,
      };
      member.value += row.value;
      member.invested += row.invested;
      byMemberMap.set(row.memberId, member);

      const type = byTypeMap.get(row.assetType) || { assetType: row.assetType, value: 0, invested: 0 };
      type.value += row.value;
      type.invested += row.invested;
      byTypeMap.set(row.assetType, type);
    }

    const members = await prisma.familyMember.findMany({
      where: { familyId: auth.familyId },
      orderBy: { createdAt: "asc" },
    });
    for (const member of members) {
      if (!byMemberMap.has(member.id)) {
        byMemberMap.set(member.id, {
          memberId: member.id,
          memberName: member.fullName,
          value: 0,
          invested: 0,
        });
      }
    }

    return {
      scope: q.memberId ? "member" : "family",
      totalValue,
      totalInvested,
      pnl: totalValue - totalInvested,
      pnlPercent: totalInvested === 0 ? 0 : ((totalValue - totalInvested) / totalInvested) * 100,
      byMember: [...byMemberMap.values()],
      byType: [...byTypeMap.values()].sort((a, b) => b.value - a.value),
    };
  });
}
