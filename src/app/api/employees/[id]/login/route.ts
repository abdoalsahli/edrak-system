import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, notFound, badRequest, requireAuth } from "@/lib/api";
import { EMPLOYEE_ROLES } from "@/lib/staff";

/**
 * حساب المستخدم — the login a manager gives an employee, with its role
 * (مدير / موظف استقبال / محاسب). One login per employee.
 */
const CreateSchema = z.object({
  email: z.string().trim().toLowerCase().email("البريد الإلكتروني غير صالح"),
  password: z.string().min(6, "كلمة المرور 6 أحرف على الأقل"),
  role: z.enum(EMPLOYEE_ROLES),
});
const UpdateSchema = z.object({
  password: z.string().min(6, "كلمة المرور 6 أحرف على الأقل").optional(),
  isActive: z.boolean().optional(),
  role: z.enum(EMPLOYEE_ROLES).optional(),
});

const loginSelect = { id: true, email: true, isActive: true, role: true } as const;

async function loadEmployee(id: string) {
  return prisma.employee.findUnique({
    where: { id },
    select: { id: true, fullName: true, isActive: true, user: { select: loginSelect } },
  });
}

const view = (u: { email: string; isActive: boolean; role: string } | null) =>
  u ? { email: u.email, isActive: u.isActive, role: u.role } : null;

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth(["MANAGER"]);
  if (auth instanceof NextResponse) return auth;
  const e = await loadEmployee(params.id);
  if (!e) return notFound("الموظف غير موجود");
  return ok({ login: view(e.user), self: e.user?.id === auth.id });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth(["MANAGER"]);
  if (auth instanceof NextResponse) return auth;
  const e = await loadEmployee(params.id);
  if (!e) return notFound("الموظف غير موجود");
  if (e.user) return badRequest({ message: "لهذا الموظف حساب مستخدم بالفعل" });

  const parsed = CreateSchema.safeParse(await req.json());
  if (!parsed.success) return badRequest(parsed.error.flatten().fieldErrors);
  const d = parsed.data;
  if (await prisma.user.findUnique({ where: { email: d.email } })) {
    return badRequest({ message: "هذا البريد مستخدم لحساب آخر" });
  }

  const user = await prisma.$transaction(async (tx) => {
    const u = await tx.user.create({
      data: { name: e.fullName, email: d.email, password: await bcrypt.hash(d.password, 10), role: d.role, isActive: e.isActive },
      select: loginSelect,
    });
    await tx.employee.update({ where: { id: e.id }, data: { userId: u.id } });
    return u;
  });
  return ok({ login: view(user), self: false }, 201);
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth(["MANAGER"]);
  if (auth instanceof NextResponse) return auth;
  const e = await loadEmployee(params.id);
  if (!e) return notFound("الموظف غير موجود");
  if (!e.user) return badRequest({ message: "لا يوجد حساب مستخدم لهذا الموظف" });

  const parsed = UpdateSchema.safeParse(await req.json());
  if (!parsed.success) return badRequest(parsed.error.flatten().fieldErrors);
  const d = parsed.data;

  const self = e.user.id === auth.id;
  // A manager cannot lock themself out
  if (self && d.isActive === false) return badRequest({ message: "لا يمكنك تعطيل حسابك أنت" });
  if (self && d.role && d.role !== "MANAGER") return badRequest({ message: "لا يمكنك تغيير صلاحية حسابك أنت" });
  if (d.isActive && !e.isActive) return badRequest({ message: "الموظف موقوف — فعّل الموظف أولاً" });

  const user = await prisma.user.update({
    where: { id: e.user.id },
    data: {
      ...(d.password ? { password: await bcrypt.hash(d.password, 10) } : {}),
      ...(d.isActive !== undefined ? { isActive: d.isActive } : {}),
      ...(d.role ? { role: d.role } : {}),
    },
    select: loginSelect,
  });
  return ok({ login: view(user), self });
}
