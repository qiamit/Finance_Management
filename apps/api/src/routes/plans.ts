import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { PLAN_TYPES } from "@fm/shared";
import { prisma } from "../lib/prisma";
import { assertCanWrite, requireAuth } from "../lib/auth";
import { num } from "../lib/serialize";

const planSchema = z.object({
  memberId: z.string().min(1),
  type: z.enum(PLAN_TYPES),
  name: z.string().min(1),
  amount: z.number().positive(),
  dayOfMonth: z.number().int().min(1).max(28),
  startDate: z.string(),
  holdingId: z.string().optional().nullable(),
  active: z.boolean().optional(),
});

export async function planRoutes(app: FastifyInstance) {
  app.get("/plans", async (request) => {
    const auth = await requireAuth(request);
    const plans = await prisma.recurringPlan.findMany({
      where: { familyId: auth.familyId },
      include: { member: { select: { fullName: true } } },
      orderBy: { createdAt: "desc" },
    });
    return plans.map((plan) => ({
      ...plan,
      amount: num(plan.amount),
      memberName: plan.member.fullName,
    }));
  });

  app.post("/plans", async (request) => {
    const auth = await requireAuth(request);
    assertCanWrite(auth.role);
    const body = planSchema.parse(request.body);
    const member = await prisma.familyMember.findFirst({
      where: { id: body.memberId, familyId: auth.familyId },
    });
    if (!member) {
      const err = new Error("Member not found");
      (err as Error & { statusCode?: number }).statusCode = 400;
      throw err;
    }
    const plan = await prisma.recurringPlan.create({
      data: {
        familyId: auth.familyId,
        memberId: body.memberId,
        type: body.type,
        name: body.name,
        amount: body.amount,
        dayOfMonth: body.dayOfMonth,
        startDate: new Date(body.startDate),
        holdingId: body.holdingId || null,
      },
      include: { member: { select: { fullName: true } } },
    });
    return { ...plan, amount: num(plan.amount), memberName: plan.member.fullName };
  });

  app.patch("/plans/:id", async (request, reply) => {
    const auth = await requireAuth(request);
    assertCanWrite(auth.role);
    const id = (request.params as { id: string }).id;
    const existing = await prisma.recurringPlan.findFirst({
      where: { id, familyId: auth.familyId },
    });
    if (!existing) return reply.code(404).send({ error: "Plan not found" });
    const body = planSchema.partial().parse(request.body);
    const plan = await prisma.recurringPlan.update({
      where: { id },
      data: {
        memberId: body.memberId,
        type: body.type,
        name: body.name,
        amount: body.amount,
        dayOfMonth: body.dayOfMonth,
        startDate: body.startDate ? new Date(body.startDate) : undefined,
        holdingId: body.holdingId,
        active: body.active,
      },
      include: { member: { select: { fullName: true } } },
    });
    return { ...plan, amount: num(plan.amount), memberName: plan.member.fullName };
  });

  app.delete("/plans/:id", async (request, reply) => {
    const auth = await requireAuth(request);
    assertCanWrite(auth.role);
    const id = (request.params as { id: string }).id;
    const existing = await prisma.recurringPlan.findFirst({
      where: { id, familyId: auth.familyId },
    });
    if (!existing) return reply.code(404).send({ error: "Plan not found" });
    await prisma.recurringPlan.delete({ where: { id } });
    return { ok: true };
  });
}
