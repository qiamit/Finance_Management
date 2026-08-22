import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { MEMBER_RELATIONS } from "@fm/shared";
import { prisma } from "../lib/prisma";
import { assertCanWrite, requireAuth } from "../lib/auth";
import { encryptText, maskPan, panLast4 } from "../lib/crypto";

const memberSchema = z.object({
  fullName: z.string().min(2),
  relation: z.enum(MEMBER_RELATIONS),
  dateOfBirth: z.string().optional().nullable(),
  pan: z.string().optional().nullable(),
});

function serializeMember(member: {
  id: string;
  fullName: string;
  relation: string;
  dateOfBirth: Date | null;
  panLast4: string | null;
  userId: string | null;
  createdAt: Date;
}) {
  return {
    ...member,
    panMasked: maskPan(member.panLast4),
  };
}

export async function memberRoutes(app: FastifyInstance) {
  app.get("/members", async (request) => {
    const auth = await requireAuth(request);
    const members = await prisma.familyMember.findMany({
      where: { familyId: auth.familyId },
      orderBy: { createdAt: "asc" },
    });
    return members.map(serializeMember);
  });

  app.post("/members", async (request) => {
    const auth = await requireAuth(request);
    assertCanWrite(auth.role);
    const body = memberSchema.parse(request.body);
    const pan = body.pan?.replace(/\s+/g, "").toUpperCase();
    const member = await prisma.familyMember.create({
      data: {
        familyId: auth.familyId,
        fullName: body.fullName,
        relation: body.relation,
        dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : null,
        panEncrypted: pan ? encryptText(pan) : null,
        panLast4: pan ? panLast4(pan) : null,
      },
    });
    return serializeMember(member);
  });

  app.get("/members/:id", async (request, reply) => {
    const auth = await requireAuth(request);
    const id = (request.params as { id: string }).id;
    const member = await prisma.familyMember.findFirst({
      where: { id, familyId: auth.familyId },
    });
    if (!member) return reply.code(404).send({ error: "Member not found" });
    return serializeMember(member);
  });

  app.patch("/members/:id", async (request, reply) => {
    const auth = await requireAuth(request);
    assertCanWrite(auth.role);
    const id = (request.params as { id: string }).id;
    const existing = await prisma.familyMember.findFirst({
      where: { id, familyId: auth.familyId },
    });
    if (!existing) return reply.code(404).send({ error: "Member not found" });
    const body = memberSchema.partial().parse(request.body);
    const pan = body.pan?.replace(/\s+/g, "").toUpperCase();
    const member = await prisma.familyMember.update({
      where: { id },
      data: {
        fullName: body.fullName,
        relation: body.relation,
        dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : undefined,
        panEncrypted: pan ? encryptText(pan) : undefined,
        panLast4: pan ? panLast4(pan) : undefined,
      },
    });
    return serializeMember(member);
  });

  app.delete("/members/:id", async (request, reply) => {
    const auth = await requireAuth(request);
    assertCanWrite(auth.role);
    const id = (request.params as { id: string }).id;
    const existing = await prisma.familyMember.findFirst({
      where: { id, familyId: auth.familyId },
    });
    if (!existing) return reply.code(404).send({ error: "Member not found" });
    if (existing.relation === "SELF" && existing.userId === auth.userId) {
      return reply.code(400).send({ error: "Cannot delete the primary member" });
    }
    await prisma.familyMember.delete({ where: { id } });
    return { ok: true };
  });
}
