import { NextResponse } from "next/server";
import { requireAuth, ok, badRequest } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const CreateSchema = z.object({
  name: z.string().trim().min(1, "اسم طريقة الدفع مطلوب"),
  cashAccountId: z.string({ required_error: "اختر الصندوق" }).min(1, "اختر الصندوق"),
  sortOrder: z.number().int().optional(),
});

/**
 * طرق الدفع. Every signed-in user can read them (reception takes payments at
 * booking); only finance staff may change them. `?all=1` includes disabled ones.
 */
export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const includeInactive = new URL(req.url).searchParams.get("all") === "1";
  const rows = await prisma.paymentMethod.findMany({
    where: includeInactive ? {} : { isActive: true, cashAccount: { isActive: true } },
    include: {
      cashAccount: { select: { id: true, name: true, type: true, isActive: true } },
      _count: { select: { payments: true, disbursements: true } },
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  // Totals per method, so the settings page doubles as a by-method summary
  const [received, paid] = await Promise.all([
    prisma.payment.groupBy({ by: ["paymentMethodId"], _sum: { amount: true } }),
    prisma.disbursement.groupBy({ by: ["paymentMethodId"], _sum: { amount: true } }),
  ]);
  const inOf = new Map(received.map((r) => [r.paymentMethodId, Number(r._sum.amount ?? 0)]));
  const outOf = new Map(paid.map((r) => [r.paymentMethodId, Number(r._sum.amount ?? 0)]));

  return NextResponse.json({
    data: rows.map(({ _count, ...m }) => ({
      ...m,
      usage: _count.payments + _count.disbursements,
      totalIn: inOf.get(m.id) ?? 0,
      totalOut: outOf.get(m.id) ?? 0,
    })),
  });
}

export async function POST(req: Request) {
  const auth = await requireAuth(["MANAGER", "ACCOUNTANT"]);
  if (auth instanceof NextResponse) return auth;

  const parsed = CreateSchema.safeParse(await req.json());
  if (!parsed.success) return badRequest(parsed.error.flatten().fieldErrors);
  const d = parsed.data;

  const box = await prisma.cashAccount.findUnique({ where: { id: d.cashAccountId }, select: { isActive: true } });
  if (!box) return badRequest({ message: "الصندوق غير موجود" });
  if (!box.isActive) return badRequest({ message: "لا يمكن الربط بصندوق معطّل" });
  if (await prisma.paymentMethod.findUnique({ where: { name: d.name } })) {
    return badRequest({ message: `طريقة الدفع «${d.name}» موجودة بالفعل` });
  }

  const last = await prisma.paymentMethod.aggregate({ _max: { sortOrder: true } });
  const method = await prisma.paymentMethod.create({
    data: { name: d.name, cashAccountId: d.cashAccountId, sortOrder: d.sortOrder ?? (last._max.sortOrder ?? 0) + 1 },
  });
  return ok(method, 201);
}
