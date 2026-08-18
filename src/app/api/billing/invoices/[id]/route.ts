import { NextResponse } from "next/server";
import { requireAuth, ok, notFound, badRequest } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth(["MANAGER", "ACCOUNTANT"]);
  if (auth instanceof NextResponse) return auth;

  const inv = await prisma.invoice.findUnique({
    where: { id: params.id },
    include: {
      patient: { select: { fullName: true } },
      billingCycle: { include: { program: { include: { service: { select: { name: true } }, therapist: { select: { fullName: true } } } } } },
      lines: { include: { session: { select: { programSequenceNumber: true, status: true } } } },
      payments: true,
    },
  });

  if (!inv) return notFound();
  return ok(inv);
}

const UpdateSchema = z.object({
  status: z.enum(["DRAFT", "ISSUED", "VOID"]).optional(),
  notes: z.string().optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth(["MANAGER", "ACCOUNTANT"]);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json();
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.flatten().fieldErrors);

  const inv = await prisma.invoice.findUnique({ where: { id: params.id } });
  if (!inv) return notFound();

  if (parsed.data.status === "VOID" && auth.role !== "MANAGER") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const updated = await prisma.invoice.update({
    where: { id: params.id },
    data: parsed.data,
  });

  return ok(updated);
}
