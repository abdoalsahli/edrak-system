import { NextResponse } from "next/server";
import { requireAuth, ok, badRequest, notFound } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const UpdateSchema = z.object({
  name: z.string().min(1).optional(),
  accountNumber: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  notes: z.string().nullable().optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth(["MANAGER", "ACCOUNTANT"]);
  if (auth instanceof NextResponse) return auth;

  const existing = await prisma.cashAccount.findUnique({ where: { id: params.id } });
  if (!existing) return notFound();

  const parsed = UpdateSchema.safeParse(await req.json());
  if (!parsed.success) return badRequest(parsed.error.flatten().fieldErrors);

  // Opening balance is intentionally immutable — changing it would silently
  // rewrite every historical balance. Create a new account instead.
  const updated = await prisma.cashAccount.update({
    where: { id: params.id },
    data: parsed.data,
  });
  return ok(updated);
}
