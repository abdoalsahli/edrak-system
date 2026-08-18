import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, notFound, badRequest, requireAuth } from "@/lib/api";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional().nullable(),
  deliveryType: z.enum(["SINGLE_SESSION", "PROGRAM"]).optional(),
  defaultSessionsPerWeek: z.number().int().positive().optional().nullable(),
  defaultTotalSessions: z.number().int().positive().optional().nullable(),
  defaultDurationMin: z.number().int().positive().optional(),
  defaultBillingCycleType: z.enum(["MONTHLY", "PER_N_SESSIONS"]).optional().nullable(),
  defaultBillingCycleValue: z.number().int().positive().optional().nullable(),
  defaultPrice: z.number().positive().optional().nullable(),
  isActive: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth(["MANAGER"]);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.errors[0].message);
  const existing = await prisma.service.findUnique({ where: { id: params.id } });
  if (!existing) return notFound("الخدمة غير موجودة");
  const service = await prisma.service.update({ where: { id: params.id }, data: parsed.data });
  return ok(service);
}
