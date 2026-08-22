import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { clearAuthCookie, requireAuth, setAuthCookie, signToken } from "../lib/auth";

const signupSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  familyName: z.string().min(2).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const inviteAcceptSchema = z.object({
  token: z.string().min(10),
  name: z.string().min(2),
  password: z.string().min(8),
});

export async function authRoutes(app: FastifyInstance) {
  app.post("/auth/signup", async (request, reply) => {
    const body = signupSchema.parse(request.body);
    const existing = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
    if (existing) {
      return reply.code(409).send({ error: "Email already registered" });
    }
    const passwordHash = await bcrypt.hash(body.password, 12);
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: body.email.toLowerCase(),
          name: body.name,
          passwordHash,
        },
      });
      const family = await tx.family.create({
        data: {
          name: body.familyName || `${body.name}'s Family`,
          createdBy: user.id,
        },
      });
      await tx.familyMembership.create({
        data: { familyId: family.id, userId: user.id, role: "OWNER" },
      });
      const member = await tx.familyMember.create({
        data: { familyId: family.id, fullName: body.name, relation: "SELF", userId: user.id },
      });
      return { user, family, member };
    });
    const token = signToken({ sub: result.user.id, email: result.user.email });
    setAuthCookie(reply, token);
    return {
      user: { id: result.user.id, email: result.user.email, name: result.user.name },
      family: { id: result.family.id, name: result.family.name },
    };
  });

  app.post("/auth/login", async (request, reply) => {
    const body = loginSchema.parse(request.body);
    const user = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
    if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) {
      return reply.code(401).send({ error: "Invalid email or password" });
    }
    const token = signToken({ sub: user.id, email: user.email });
    setAuthCookie(reply, token);
    const membership = await prisma.familyMembership.findFirst({
      where: { userId: user.id },
      include: { family: true },
      orderBy: { createdAt: "asc" },
    });
    return {
      user: { id: user.id, email: user.email, name: user.name },
      family: membership ? { id: membership.family.id, name: membership.family.name } : null,
    };
  });

  app.post("/auth/logout", async (_request, reply) => {
    clearAuthCookie(reply);
    return { ok: true };
  });

  app.get("/auth/me", async (request, reply) => {
    try {
      const auth = await requireAuth(request);
      return {
        user: { id: auth.userId, email: auth.email, name: auth.name },
        family: { id: auth.familyId, name: auth.familyName },
        role: auth.role,
        geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
        casParserConfigured: Boolean(process.env.CASPARSER_API_KEY),
      };
    } catch {
      return reply.code(401).send({ error: "Unauthorized" });
    }
  });

  app.get("/auth/invite/:token", async (request, reply) => {
    const token = (request.params as { token: string }).token;
    const invite = await prisma.invite.findUnique({
      where: { token },
      include: { family: true },
    });
    if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
      return reply.code(404).send({ error: "Invite is invalid or expired" });
    }
    return { email: invite.email, familyName: invite.family.name, role: invite.role };
  });

  app.post("/auth/invite/accept", async (request, reply) => {
    const body = inviteAcceptSchema.parse(request.body);
    const invite = await prisma.invite.findUnique({ where: { token: body.token } });
    if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
      return reply.code(400).send({ error: "Invite is invalid or expired" });
    }
    const passwordHash = await bcrypt.hash(body.password, 12);
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.upsert({
        where: { email: invite.email.toLowerCase() },
        update: { name: body.name, passwordHash },
        create: { email: invite.email.toLowerCase(), name: body.name, passwordHash },
      });
      await tx.familyMembership.upsert({
        where: { familyId_userId: { familyId: invite.familyId, userId: created.id } },
        update: { role: invite.role },
        create: { familyId: invite.familyId, userId: created.id, role: invite.role },
      });
      await tx.invite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() },
      });
      return created;
    });
    const token = signToken({ sub: user.id, email: user.email });
    setAuthCookie(reply, token);
    return { user: { id: user.id, email: user.email, name: user.name } };
  });
}
