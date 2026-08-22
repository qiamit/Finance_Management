import jwt from "jsonwebtoken";
import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "./prisma";
import type { MembershipRole } from "@prisma/client";

const COOKIE = "fm_token";

export type TokenPayload = {
  sub: string;
  email: string;
};

function jwtSecret(): string {
  return process.env.JWT_SECRET || "dev-jwt-secret-change-me";
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, jwtSecret(), { expiresIn: "14d" });
}

export function cookieOptions() {
  const crossSite = process.env.COOKIE_CROSS_SITE === "true";
  return {
    httpOnly: true,
    path: "/",
    sameSite: (crossSite ? "none" : "lax") as "none" | "lax",
    secure: crossSite || process.env.NODE_ENV === "production",
    maxAge: 14 * 24 * 60 * 60,
  };
}

export function setAuthCookie(reply: FastifyReply, token: string) {
  reply.setCookie(COOKIE, token, cookieOptions());
}

export function clearAuthCookie(reply: FastifyReply) {
  reply.clearCookie(COOKIE, { ...cookieOptions(), maxAge: 0 });
}

export function readToken(request: FastifyRequest): TokenPayload | null {
  const header = request.headers.authorization;
  const bearer = header?.startsWith("Bearer ") ? header.slice(7) : null;
  const token = bearer || request.cookies?.[COOKIE];
  if (!token) return null;
  try {
    return jwt.verify(token, jwtSecret()) as TokenPayload;
  } catch {
    return null;
  }
}

export type AuthContext = {
  userId: string;
  email: string;
  name: string;
  familyId: string;
  familyName: string;
  role: MembershipRole;
};

const WRITE_ROLES: MembershipRole[] = ["OWNER", "ADMIN", "MEMBER"];

export async function requireAuth(request: FastifyRequest): Promise<AuthContext> {
  const payload = readToken(request);
  if (!payload) {
    const err = new Error("Unauthorized");
    (err as Error & { statusCode?: number }).statusCode = 401;
    throw err;
  }

  const memberships = await prisma.familyMembership.findMany({
    where: { userId: payload.sub },
    include: { family: true, user: true },
    orderBy: { createdAt: "asc" },
  });
  if (memberships.length === 0) {
    const err = new Error("No family membership");
    (err as Error & { statusCode?: number }).statusCode = 403;
    throw err;
  }

  const requested = (request.headers["x-family-id"] as string | undefined) || undefined;
  const membership =
    memberships.find((item) => item.familyId === requested) ?? memberships[0];

  return {
    userId: membership.userId,
    email: membership.user.email,
    name: membership.user.name,
    familyId: membership.familyId,
    familyName: membership.family.name,
    role: membership.role,
  };
}

export function assertCanWrite(role: MembershipRole) {
  if (!WRITE_ROLES.includes(role)) {
    const err = new Error("Read-only role cannot modify data");
    (err as Error & { statusCode?: number }).statusCode = 403;
    throw err;
  }
}
