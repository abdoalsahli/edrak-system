import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, notFound, badRequest, requireAuth } from "@/lib/api";

const UpdateSchema = z.object({
  fullName: z.string().trim().min(2, "الاسم مطلوب").optional(),
  jobTitle: z.string().trim().nullish(),
  phone: z.string().trim().nullish(),
  isActive: z.boolean().optional(),
});

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth(["MANAGER"]);
  if (auth instanceof NextResponse) return auth;
  const employee = await prisma.employee.findUnique({ where: { id: params.id } });
  if (!employee) return notFound("الموظف غير موجود");
  return ok(employee);
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth(["MANAGER"]);
  if (auth instanceof NextResponse) return auth;
  const employee = await prisma.employee.findUnique({ where: { id: params.id } });
  if (!employee) return notFound("الموظف غير موجود");

  const parsed = UpdateSchema.safeParse(await req.json());
  if (!parsed.success) return badRequest(parsed.error.flatten().fieldErrors);
  const d = parsed.data;
  if (d.isActive === false && employee.userId === auth.id) {
    return badRequest({ message: "لا يمكنك إيقاف حسابك أنت" });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const e = await tx.employee.update({
      where: { id: employee.id },
      data: {
        ...(d.fullName !== undefined ? { fullName: d.fullName } : {}),
        ...(d.jobTitle !== undefined ? { jobTitle: d.jobTitle || null } : {}),
        ...(d.phone !== undefined ? { phone: d.phone || null } : {}),
        ...(d.isActive !== undefined ? { isActive: d.isActive } : {}),
      },
    });
    if (e.userId) {
      // The login carries the same name; a stopped employee cannot sign in
      await tx.user.update({
        where: { id: e.userId },
        data: { name: e.fullName, ...(d.isActive === false ? { isActive: false } : {}) },
      });
    }
    return e;
  });
  return ok(updated);
}
