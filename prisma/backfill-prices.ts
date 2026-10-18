/**
 * One-off repair: services were created without a price, so every auto-invoice
 * came out as a zero-value DRAFT and completed sessions never got an invoice
 * line or a therapist commission.
 *
 * Run with:  npx tsx prisma/backfill-prices.ts
 */
import { PrismaClient } from "@prisma/client";
import { recalcProgramInvoice, recalcSessionInvoice } from "../src/lib/billing/InvoiceService";

const prisma = new PrismaClient();

const PRICES: Record<string, number> = {
  "تقييم أولي": 300,
  "استشارة": 250,
  "علاج النطق": 200,
  "العلاج الوظيفي": 200,
  "تحليل السلوك التطبيقي (ABA)": 180,
  "الإرشاد النفسي": 220,
  "تأهيل الإدمان": 250,
};

const DEFAULT_PRICE = 200; // for any service not in the list above

async function main() {
  // ── 1. Give every service a price ────────────────────────────────────────
  const services = await prisma.service.findMany();
  let priced = 0;
  for (const s of services) {
    if (s.defaultPrice != null && Number(s.defaultPrice) > 0) continue;
    const price = PRICES[s.name] ?? DEFAULT_PRICE;
    await prisma.service.update({ where: { id: s.id }, data: { defaultPrice: price } });
    console.log(`  price set: ${s.name} → ${price} ر.س`);
    priced++;
  }
  console.log(`✔ ${priced} service(s) priced\n`);

  // ── 2. Add missing invoice lines for already-completed sessions ───────────
  const completed = await prisma.session.findMany({
    where: { status: "COMPLETED" },
    include: {
      service: { select: { name: true, defaultPrice: true } },
      invoiceLines: { select: { id: true } },
      appointments: {
        where: { deletedAt: null },
        include: { therapist: { select: { id: true, commissionType: true, commissionRate: true, commissionFixed: true } } },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      commission: { select: { id: true } },
    },
  });

  let linesAdded = 0;
  let commissionsAdded = 0;

  for (const s of completed) {
    const unitPrice = Number(s.service?.defaultPrice ?? 0);
    if (unitPrice <= 0) continue;

    // 2a. invoice line
    if (s.invoiceLines.length === 0) {
      const invoice = s.programId
        ? await prisma.invoice.findUnique({ where: { programId: s.programId } })
        : await prisma.invoice.findUnique({ where: { sessionId: s.id } });
      if (invoice) {
        await prisma.invoiceLine.create({
          data: {
            invoiceId: invoice.id,
            sessionId: s.id,
            description: `${s.service?.name ?? "جلسة"} — جلسة مكتملة`,
            qty: 1,
            unitPrice,
            discount: 0,
            total: unitPrice,
          },
        });
        linesAdded++;
      }
    }

    // 2b. therapist commission
    const apt = s.appointments[0];
    const t = apt?.therapist;
    if (!s.commission && t?.commissionType) {
      if (t.commissionType === "FIXED" && t.commissionFixed) {
        await prisma.therapistCommission.create({
          data: {
            therapistId: apt.therapistId,
            sessionId: s.id,
            commissionType: "FIXED",
            rate: null,
            baseAmount: null,
            amount: Number(t.commissionFixed),
          },
        });
        commissionsAdded++;
      } else if (t.commissionType === "PERCENTAGE" && t.commissionRate) {
        const rate = Number(t.commissionRate);
        await prisma.therapistCommission.create({
          data: {
            therapistId: apt.therapistId,
            sessionId: s.id,
            commissionType: "PERCENTAGE",
            rate,
            baseAmount: unitPrice,
            amount: (unitPrice * rate) / 100,
          },
        });
        commissionsAdded++;
      }
    }
  }
  console.log(`✔ ${linesAdded} invoice line(s) added`);
  console.log(`✔ ${commissionsAdded} commission(s) added\n`);

  // ── 3. Recalculate every auto-invoice ────────────────────────────────────
  const autoInvoices = await prisma.invoice.findMany({
    where: { OR: [{ programId: { not: null } }, { sessionId: { not: null } }] },
    select: { id: true, programId: true, sessionId: true, status: true },
  });

  let recalced = 0;
  for (const inv of autoInvoices) {
    const res = await prisma.$transaction((tx) =>
      inv.programId
        ? recalcProgramInvoice(tx, inv.programId)
        : recalcSessionInvoice(tx, inv.sessionId!)
    );
    if (res) {
      console.log(
        `  ${inv.programId ? "program" : "session"} ${inv.id.slice(0, 8)} → ${res.totalAmount} ر.س  [${res.status}]` +
          (res.credit > 0 ? `  ⚠ credit ${res.credit}` : "")
      );
      recalced++;
    }
  }
  console.log(`\n✔ ${recalced} invoice(s) recalculated`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
