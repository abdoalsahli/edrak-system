import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, badRequest, requireAuth, paginate } from "@/lib/api";
import { z } from "zod";
import { setOpeningBalance } from "@/lib/ledger/LedgerService";

const createSchema = z.object({
  fullName: z.string().trim().min(2, "اسم الحالة مطلوب (حرفان على الأقل)"),
  dob: z.string().optional().nullable(),
  gender: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  nationalId: z.string().optional().nullable(),
  patientType: z.enum(["ADULT", "CHILD"]).default("ADULT"),
  guardian: z.object({
    fullName: z.string().trim().min(2, "اسم ولي الأمر مطلوب (حرفان على الأقل)"),
    relationship: z.string().optional().nullable(),
    phone: z.string().optional().nullable(),
    nationalId: z.string().optional().nullable(),
  }).optional().nullable(),
  // الرصيد الافتتاحي — in the account's direction; managers and accountants only
  openingBalance: z.object({
    amount: z.number(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  }).nullish(),
});

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const { skip, take } = paginate(url.searchParams);
  const q = url.searchParams.get("q") ?? "";
  const active = url.searchParams.get("active");

  const where = {
    ...(active !== null ? { isActive: active === "true" } : {}),
    ...(q ? {
      OR: [
        { fullName: { contains: q } },
        { phone: { contains: q } },
        { nationalId: { contains: q } },
      ],
    } : {}),
  };

  const [patients, total] = await Promise.all([
    prisma.patient.findMany({
      where,
      include: { guardian: true },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.patient.count({ where }),
  ]);

  return ok({ data: patients, total, skip, take });
}

export async function POST(req: Request) {
  const auth = await requireAuth(["RECEPTIONIST", "MANAGER"]);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.errors[0].message);

  const { guardian, openingBalance, ...data } = parsed.data;
  const withOpening = openingBalance && Math.abs(openingBalance.amount) >= 0.005;
  if (withOpening && auth.role !== "MANAGER") {
    return badRequest("الرصيد الافتتاحي يدخله المدير أو المحاسب");
  }

  const patient = await prisma.$transaction(async (tx) => {
    const p = await tx.patient.create({
      data: {
        ...data,
        dob: data.dob ? new Date(data.dob) : null,
        ...(guardian ? { guardian: { create: guardian } } : {}),
      },
      include: { guardian: true },
    });
    if (withOpening) {
      await setOpeningBalance(tx, { patientId: p.id }, openingBalance.amount, openingBalance.date ? new Date(openingBalance.date) : null);
    }
    return p;
  });

  return ok(patient, 201);
}
