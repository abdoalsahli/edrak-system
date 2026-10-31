import { NextResponse } from "next/server";
import { requireAuth, ok, badRequest, notFound } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { getAccountStatement, getPatientAccountId, getTherapistAccountId, getCashLedgerAccountId } from "@/lib/ledger/LedgerService";

/**
 * كشف حساب — any current account, with a running balance.
 * The id may also be "patient:<id>" or "therapist:<id>", resolved (and created
 * on first use) to that party's account.
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth(["MANAGER", "ACCOUNTANT"]);
  if (auth instanceof NextResponse) return auth;

  // Accept "patient:<id>" whether or not the colon arrives URL-encoded
  const key = decodeURIComponent(params.id);
  let accountId = key;
  const [prefix, partyId] = key.split(":");
  if (partyId && (prefix === "patient" || prefix === "therapist" || prefix === "cash")) {
    const exists =
      prefix === "patient"
        ? await prisma.patient.count({ where: { id: partyId } })
        : prefix === "therapist"
        ? await prisma.therapist.count({ where: { id: partyId } })
        : await prisma.cashAccount.count({ where: { id: partyId } });
    if (!exists) return notFound();
    accountId = await prisma.$transaction((tx) =>
      prefix === "patient"
        ? getPatientAccountId(tx, partyId)
        : prefix === "therapist"
        ? getTherapistAccountId(tx, partyId)
        : getCashLedgerAccountId(tx, partyId)
    );
  }

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const statement = await getAccountStatement(
    prisma,
    accountId,
    from ? new Date(from) : null,
    to ? new Date(to) : null
  );
  if (!statement) return notFound();
  return NextResponse.json(statement);
}

const UpdateSchema = z.object({
  name: z.string().min(1).optional(),
  notes: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth(["MANAGER", "ACCOUNTANT"]);
  if (auth instanceof NextResponse) return auth;

  const account = await prisma.ledgerAccount.findUnique({ where: { id: params.id } });
  if (!account) return notFound();

  const parsed = UpdateSchema.safeParse(await req.json());
  if (!parsed.success) return badRequest(parsed.error.flatten().fieldErrors);

  // A patient / therapist account is named after its party — rename the party instead
  if (parsed.data.name && (account.patientId || account.therapistId)) {
    return badRequest({ message: "اسم حساب الحالة أو الأخصائي يتبع الاسم في الملف" });
  }
  // The nature of an account is fixed: changing it would flip the sign of its history

  const updated = await prisma.ledgerAccount.update({ where: { id: params.id }, data: parsed.data });
  return ok(updated);
}
