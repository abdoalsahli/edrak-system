/**
 * One-off: move programme commissions from per-session ledger entries to one
 * entry per programme (+ adjustments), fix entries dated in the future, and
 * cancel the leftover pending sessions of programmes already completed.
 * Writes a backup of every entry it touches to /backups first. Safe to re-run.
 *
 *   npx ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node"}' prisma/migrate-program-commissions.ts
 */
import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();
const r2 = (n: number) => Math.round(n * 100) / 100;

async function main() {
  const programs = await prisma.program.findMany({
    select: {
      id: true, status: true,
      patient: { select: { fullName: true } },
      service: { select: { name: true } },
      sessions: { select: { id: true } },
    },
  });
  const sessionToProgram = new Map<string, (typeof programs)[number]>();
  for (const p of programs) for (const s of p.sessions) sessionToProgram.set(s.id, p);

  const oldEntries = await prisma.ledgerEntry.findMany({
    where: { sourceType: "COMMISSION", sourceId: { in: [...sessionToProgram.keys()] } },
    orderBy: { createdAt: "asc" },
  });
  const futureEntries = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM ledger_entries WHERE date > DATE(createdAt)`;

  const dir = path.join(__dirname, "..", "backups");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `before-program-commissions-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(file, JSON.stringify({ oldEntries, futureEntries }, null, 2));
  console.log(`backup: ${file} (${oldEntries.length} commission entries, ${futureEntries.length} future-dated)`);

  await prisma.$transaction(async (tx) => {
    // 1. Per-session commission entries → one entry per programme per posting batch
    type Group = { programId: string; accountId: string; at: Date; date: Date; net: number; dn: number; amounts: number[]; createdBy: string | null };
    const groups = new Map<string, Group>();
    for (const e of oldEntries) {
      const prog = sessionToProgram.get(e.sourceId)!;
      const at = new Date(Math.floor(e.createdAt.getTime() / 1000) * 1000); // same request = same second
      const key = `${prog.id}|${e.accountId}|${at.getTime()}`;
      const g = groups.get(key) ?? { programId: prog.id, accountId: e.accountId, at, date: e.date, net: 0, dn: 0, amounts: [], createdBy: e.createdBy };
      const credit = Number(e.credit), debit = Number(e.debit);
      g.net = r2(g.net + credit - debit);
      g.dn += credit > 0 ? 1 : -1;
      if (credit > 0) g.amounts.push(credit);
      groups.set(key, g);
    }

    const running = new Map<string, { total: number; n: number }>();
    for (const g of [...groups.values()].sort((a, b) => a.at.getTime() - b.at.getTime())) {
      if (Math.abs(g.net) < 0.005) continue;
      const prog = programs.find((p) => p.id === g.programId)!;
      const base = `عمولة برنامج ${prog.service.name} — ${prog.patient.fullName}`;
      const rk = `${g.programId}|${g.accountId}`;
      const before = running.get(rk);
      const after = { total: r2((before?.total ?? 0) + g.net), n: (before?.n ?? 0) + g.dn };
      running.set(rk, after);
      const sameUnit = g.amounts.length > 0 && g.amounts.every((a) => Math.abs(a - g.amounts[0]) < 0.005);
      const description = !before
        ? (sameUnit ? `${base} — ${after.n} جلسة × ${r2(g.amounts[0])}` : `${base} — ${after.n} جلسة`)
        : after.n <= 0 ? `عكس ${base}` : `تعديل ${base} — أصبحت ${after.n} جلسة بإجمالي ${after.total}`;
      await tx.ledgerEntry.create({
        data: {
          accountId: g.accountId,
          date: g.date,
          debit: g.net < 0 ? -g.net : 0,
          credit: g.net > 0 ? g.net : 0,
          description,
          sourceType: "COMMISSION",
          sourceId: g.programId,
          createdBy: g.createdBy,
          createdAt: g.at,
        },
      });
    }
    await tx.ledgerEntry.deleteMany({ where: { id: { in: oldEntries.map((e) => e.id) } } });
    console.log(`✔ ${oldEntries.length} per-session entries → ${[...running.keys()].length} programme account(s)`);

    // 2. Entries dated after the day they were posted
    const fixed = await tx.$executeRaw`UPDATE ledger_entries SET date = DATE(createdAt) WHERE date > DATE(createdAt)`;
    console.log(`✔ ${fixed} future-dated entr${fixed === 1 ? "y" : "ies"} re-dated to the posting day`);

    // 3. Completed programmes must not keep pending sessions in the calendar
    for (const p of programs.filter((x) => x.status === "COMPLETED")) {
      const pending = await tx.session.findMany({ where: { programId: p.id, status: "PENDING" }, select: { id: true } });
      if (!pending.length) continue;
      const ids = pending.map((s) => s.id);
      await tx.session.updateMany({ where: { id: { in: ids } }, data: { status: "CANCELLED_BY_CENTER" } });
      const apts = await tx.appointment.updateMany({
        where: { sessionId: { in: ids }, status: "SCHEDULED", deletedAt: null },
        data: { status: "CANCELLED" },
      });
      console.log(`✔ ${p.service.name} — ${p.patient.fullName}: ${ids.length} sessions cancelled, ${apts.count} appointments freed`);
    }
  });
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
