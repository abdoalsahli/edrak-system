import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, notFound, badRequest, requireAuth } from "@/lib/api";

/**
 * حساب دخول الأخصائي — the login a manager gives a therapist for the portal
 * («جدولي»). One login per therapist, role THERAPIST.
 */
const CreateSchema = z.object({
  email: z.string().trim().toLowerCase().email("البريد الإلكتروني غير صالح"),
  password: z.string().min(6, "كلمة المرور 6 أحرف على الأقل"),
});
const UpdateSchema = z.object({
  password: z.string().min(6, "كلمة المرور 6 أحرف على الأقل").optional(),
  isActive: z.boolean().optional(),
});

async function loadTherapist(id: string) {
  return prisma.therapist.findUnique({
    where: { id },
    select: { id: true, fullName: true, user: { select: { id: true, email: true, isActive: true } } },
  });
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth(["MANAGER"]);
  if (auth instanceof NextResponse) return auth;
  const t = await loadTherapist(params.id);
  if (!t) return notFound("المعالج غير موجود");
  return ok({ login: t.user ? { email: t.user.email, isActive: t.user.isActive } : null });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth(["MANAGER"]);
  if (auth instanceof NextResponse) return auth;
  const t = await loadTherapist(params.id);
  if (!t) return notFound("المعالج غير موجود");
  if (t.user) return badRequest({ message: "لهذا الأخصائي حساب دخول بالفعل" });

  const parsed = CreateSchema.safeParse(await req.json());
  if (!parsed.success) return badRequest(parsed.error.flatten().fieldErrors);
  const d = parsed.data;
  if (await prisma.user.findUnique({ where: { email: d.email } })) {
    return badRequest({ message: "هذا البريد مستخدم لحساب آخر" });
  }

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { name: t.fullName, email: d.email, password: await bcrypt.hash(d.password, 10), role: "THERAPIST" },
    });
    await tx.therapist.update({ where: { id: t.id }, data: { userId: user.id } });
  });
  return ok({ login: { email: d.email, isActive: true } }, 201);
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth(["MANAGER"]);
  if (auth instanceof NextResponse) return auth;
  const t = await loadTherapist(params.id);
  if (!t) return notFound("المعالج غير موجود");
  if (!t.user) return badRequest({ message: "لا يوجد حساب دخول لهذا الأخصائي" });

  const parsed = UpdateSchema.safeParse(await req.json());
  if (!parsed.success) return badRequest(parsed.error.flatten().fieldErrors);
  const d = parsed.data;

  const user = await prisma.user.update({
    where: { id: t.user.id },
    data: {
      ...(d.password ? { password: await bcrypt.hash(d.password, 10) } : {}),
      ...(d.isActive !== undefined ? { isActive: d.isActive } : {}),
    },
    select: { email: true, isActive: true },
  });
  return ok({ login: user });
}
