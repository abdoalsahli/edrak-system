import { NextResponse } from "next/server";
import { requireAuth, ok, badRequest } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import type { AccountKind } from "@prisma/client";
import { getBalances, naturalBalance, nextAccountCode, ensurePartyAccounts } from "@/lib/ledger/LedgerService";

const CreateSchema = z.object({
  name: z.string().min(1, "اسم الحساب مطلوب"),
  // Patient and therapist accounts are created automatically with their party
  kind: z.enum(["CUSTOM", "EXPENSE"]).default("CUSTOM"),
  nature: z.enum(["DEBIT", "CREDIT"]),
  notes: z.string().optional(),
});

/** دليل الحسابات — every current account with its balance. */
export async function GET(req: Request) {
  const auth = await requireAuth(["MANAGER", "ACCOUNTANT"]);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const kind = searchParams.get("kind") as AccountKind | null;
  const q = searchParams.get("q");
  const includeInactive = searchParams.get("inactive") === "1";

  // Every patient and therapist must be pickable before their first movement
  await prisma.$transaction((tx) => ensurePartyAccounts(tx));

  const accounts = await prisma.ledgerAccount.findMany({
    where: {
      ...(kind ? { kind } : {}),
      ...(includeInactive ? {} : { isActive: true }),
      ...(q ? { OR: [{ name: { contains: q } }, { code: { contains: q } }] } : {}),
    },
    orderBy: [{ kind: "asc" }, { code: "asc" }],
  });

  const sums = await getBalances(prisma, { accountIds: accounts.map((a) => a.id) });
  const data = accounts.map((a) => {
    const t = sums.get(a.id) ?? { debit: 0, credit: 0 };
    return { ...a, debit: t.debit, credit: t.credit, balance: naturalBalance(a.nature, t.debit, t.credit) };
  });

  return NextResponse.json({ data });
}

export async function POST(req: Request) {
  const auth = await requireAuth(["MANAGER", "ACCOUNTANT"]);
  if (auth instanceof NextResponse) return auth;

  const parsed = CreateSchema.safeParse(await req.json());
  if (!parsed.success) return badRequest(parsed.error.flatten().fieldErrors);
  const d = parsed.data;

  const account = await prisma.$transaction(async (tx) =>
    tx.ledgerAccount.create({
      data: {
        code: await nextAccountCode(tx, d.kind),
        name: d.name,
        kind: d.kind,
        nature: d.nature,
        notes: d.notes ?? null,
      },
    })
  );
  return ok(account, 201);
}
