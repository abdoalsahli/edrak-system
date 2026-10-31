import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, badRequest, notFound, requireAuth } from "@/lib/api";
import { getOpeningBalance, setOpeningBalance, type OpeningParty } from "@/lib/ledger/LedgerService";

/**
 * الرصيد الافتتاحي لحالة أو أخصائي — what was owed before the system started.
 * The amount is in the account's direction: a patient's positive amount is owed
 * by the patient; a therapist's positive amount is owed to the therapist.
 */
const PutSchema = z
  .object({
    patientId: z.string().optional(),
    therapistId: z.string().optional(),
    amount: z.number(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  })
  .refine((d) => !!d.patientId !== !!d.therapistId, { message: "حدد الحالة أو الأخصائي" });

async function partyOf(patientId?: string | null, therapistId?: string | null): Promise<OpeningParty | null> {
  if (patientId) return (await prisma.patient.findUnique({ where: { id: patientId }, select: { id: true } })) ? { patientId } : null;
  if (therapistId) return (await prisma.therapist.findUnique({ where: { id: therapistId }, select: { id: true } })) ? { therapistId } : null;
  return null;
}

export async function GET(req: Request) {
  const auth = await requireAuth(["MANAGER", "ACCOUNTANT"]);
  if (auth instanceof NextResponse) return auth;
  const { searchParams } = new URL(req.url);
  const party = await partyOf(searchParams.get("patientId"), searchParams.get("therapistId"));
  if (!party) return notFound();
  const o = await getOpeningBalance(prisma, party);
  return ok({ amount: o.amount, date: o.date });
}

export async function PUT(req: Request) {
  const auth = await requireAuth(["MANAGER", "ACCOUNTANT"]);
  if (auth instanceof NextResponse) return auth;
  const parsed = PutSchema.safeParse(await req.json());
  if (!parsed.success) return badRequest({ message: parsed.error.errors[0].message });
  const d = parsed.data;
  const party = await partyOf(d.patientId, d.therapistId);
  if (!party) return notFound();

  await prisma.$transaction((tx) => setOpeningBalance(tx, party, d.amount, d.date ? new Date(d.date) : null));
  const o = await getOpeningBalance(prisma, party);
  return ok({ amount: o.amount, date: o.date });
}
