import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { UserRole } from "@/lib/enums";

export function unauthorized() {
  return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
}

export function forbidden() {
  return NextResponse.json({ error: "ممنوع" }, { status: 403 });
}

export function notFound(msg = "غير موجود") {
  return NextResponse.json({ error: msg }, { status: 404 });
}

export function badRequest(data: unknown) {
  return NextResponse.json({ error: data }, { status: 400 });
}

export function ok(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export type AuthResult = { id: string; role: UserRole };

/** Centre staff. A therapist account is never staff: it reaches only routes that name THERAPIST. */
export const STAFF_ROLES: UserRole[] = ["RECEPTIONIST", "MANAGER", "ACCOUNTANT"];

// Returns user data on success, or a NextResponse error on failure.
// Callers do: const auth = await requireAuth(); if (auth instanceof NextResponse) return auth;
// With no roles given, any STAFF member passes — safe by default for the therapist portal.
export async function requireAuth(allowedRoles: UserRole[] = STAFF_ROLES): Promise<AuthResult | NextResponse> {
  const session = await auth();
  if (!session?.user) return unauthorized();
  const user = session.user as { id: string; role: UserRole };
  if (!allowedRoles.includes(user.role)) return forbidden();
  return { id: user.id, role: user.role };
}

/** The therapist record behind a THERAPIST login (null when the account is not linked). */
export async function therapistIdOf(userId: string): Promise<string | null> {
  const t = await prisma.therapist.findUnique({ where: { userId }, select: { id: true, isActive: true } });
  return t?.isActive ? t.id : null;
}

export function paginate(searchParams: URLSearchParams, defaultPerPage = 20) {
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const take = Math.min(100, parseInt(searchParams.get("take") ?? searchParams.get("perPage") ?? String(defaultPerPage), 10));
  const skip = (page - 1) * take;
  return { page, take, skip };
}
