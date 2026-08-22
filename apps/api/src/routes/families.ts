import type { FastifyInstance } from "fastify";
import { randomBytes } from "crypto";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { assertCanWrite, requireAuth } from "../lib/auth";

const patchFamily = z.object({ name: z.string().min(2) });
const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["ADMIN", "MEMBER", "VIEWER"]).default("MEMBER"),
});

export async function familyRoutes(app: FastifyInstance) {
  app.get("/families/me", async (request) => {
    const auth = await requireAuth(request);
    const family = await prisma.family.findUniqueOrThrow({
      where: { id: auth.familyId },
      include: {
        memberships: { include: { user: { select: { id: true, email: true, name: true } } } },
      },
    });
    return {
      id: family.id,
      name: family.name,
      role: auth.role,
      memberships: family.memberships.map((m) => ({
        id: m.id,
        role: m.role,
        user: m.user,
      })),
    };
  });

  app.patch("/families/me", async (request) => {
    const auth = await requireAuth(request);
    assertCanWrite(auth.role);
    const body = patchFamily.parse(request.body);
    const family = await prisma.family.update({
      where: { id: auth.familyId },
      data: { name: body.name },
    });
    return { id: family.id, name: family.name };
  });

  app.post("/families/me/invites", async (request) => {
    const auth = await requireAuth(request);
    if (auth.role !== "OWNER" && auth.role !== "ADMIN") {
      const err = new Error("Only owners and admins can invite");
      (err as Error & { statusCode?: number }).statusCode = 403;
      throw err;
    }
    const body = inviteSchema.parse(request.body);
    const token = randomBytes(24).toString("hex");
    const invite = await prisma.invite.create({
      data: {
        familyId: auth.familyId,
        email: body.email.toLowerCase(),
        role: body.role,
        token,
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    });
    const origin = process.env.WEB_ORIGIN || "http://localhost:5173";
    return {
      id: invite.id,
      email: invite.email,
      role: invite.role,
      inviteUrl: `${origin}/invite/${invite.token}`,
      expiresAt: invite.expiresAt,
    };
  });
}
