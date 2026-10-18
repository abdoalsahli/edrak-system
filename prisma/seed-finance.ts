/**
 * Creates the default cash box, bank account and payment methods, and attributes existing
 * receipts to the main cash box. Safe to re-run.
 *
 *   npx tsx prisma/seed-finance.ts
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  let main = await prisma.cashAccount.findFirst({ where: { type: "CASH" } });
  if (!main) {
    main = await prisma.cashAccount.create({
      data: { name: "الصندوق الرئيسي", type: "CASH", openingBalance: 0, isActive: true },
    });
    console.log(`✔ أُنشئ: ${main.name}`);
  } else {
    console.log(`• موجود: ${main.name}`);
  }

  let bank = await prisma.cashAccount.findFirst({ where: { type: "BANK" } });
  if (!bank) {
    bank = await prisma.cashAccount.create({
      data: { name: "الحساب البنكي", type: "BANK", openingBalance: 0, isActive: true },
    });
    console.log(`✔ أُنشئ: ${bank.name}`);
  } else {
    console.log(`• موجود: ${bank.name}`);
  }

  // Default payment methods, each linked to its box
  const defaults = [
    { name: "نقداً", cashAccountId: main.id, sortOrder: 1 },
    { name: "تحويل مصرفي", cashAccountId: bank.id, sortOrder: 2 },
    { name: "موبي كاش", cashAccountId: bank.id, sortOrder: 3 },
  ];
  for (const m of defaults) {
    const exists = await prisma.paymentMethod.findUnique({ where: { name: m.name } });
    if (!exists) {
      await prisma.paymentMethod.create({ data: m });
      console.log(`✔ طريقة دفع: ${m.name}`);
    }
  }

  // Attribute historical receipts to the main cash box so balances reconcile
  const orphan = await prisma.payment.updateMany({
    where: { cashAccountId: null },
    data: { cashAccountId: main.id },
  });
  console.log(`✔ ${orphan.count} سند قبض رُبط بالصندوق الرئيسي`);

  const accounts = await prisma.cashAccount.findMany();
  for (const a of accounts) {
    const [ins, outs] = await Promise.all([
      prisma.payment.aggregate({ where: { cashAccountId: a.id }, _sum: { amount: true } }),
      prisma.disbursement.aggregate({ where: { cashAccountId: a.id }, _sum: { amount: true } }),
    ]);
    const bal = Number(a.openingBalance) + Number(ins._sum.amount ?? 0) - Number(outs._sum.amount ?? 0);
    console.log(`  ${a.name}: رصيد ${bal.toFixed(2)} ر.س`);
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
