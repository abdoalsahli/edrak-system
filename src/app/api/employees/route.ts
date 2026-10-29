import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, badRequest, requireAuth } from "@/lib/api";
import { EMPLOYEE_ROLES } from "@/lib/staff";

const CreateSchema = z.object({
  fullName: z.string().trim().min(2, "الاسم مطلوب"),
  jobTitle: z.string().trim().nullish(),
  phone: z.string().trim().nullish(),
  // Optional login, created together with the employee
  login: z
    .object({
      email: z.string().trim().toLowerCase().email("البريد الإلكتروني غير صالح"),
      password: z.string().min(6, "كلمة المرور 6 أحرف على الأقل"),
      role: z.enum(EMPLOYEE_ROLES),
    })
    .nullish(),
});

export async function GET() {
  const auth = await requireAuth(["MANAGER"]);
  if (auth instanceof NextResponse) return auth;
  const employees = await prisma.employee.findMany({
    orderBy: { fullName: "asc" },
    include: { user: { select: { email: true, role: true, isActive: true } } },
  });
  return ok(employees);
}

export async function POST(req: Request) {
  const auth = await requireAuth(["MANAGER"]);
  if (auth instanceof NextResponse) return auth;

  const parsed = CreateSchema.safeParse(await req.json());
  if (!parsed.success) return badRequest(parsed.error.flatten().fieldErrors);
  const d = parsed.data;
  if (d.login && (await prisma.user.findUnique({ where: { email: d.login.email } }))) {
    return badRequest({ message: "هذا البريد مستخدم لحساب آخر" });
  }

  const employee = await prisma.$transaction(async (tx) => {
    const user = d.login
      ? await tx.user.create({
          data: { name: d.fullName, email: d.login.email, password: await bcrypt.hash(d.login.password, 10), role: d.login.role },
        })
      : null;
    return tx.employee.create({
      data: { fullName: d.fullName, jobTitle: d.jobTitle || null, phone: d.phone || null, userId: user?.id ?? null },
    });
  });
  return ok(employee, 201);
}
