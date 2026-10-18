import { prisma } from "@/lib/prisma";
import { getAccountBalances } from "@/lib/billing/TreasuryService";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { arSA } from "date-fns/locale";
import { PageHeader } from "@/components/ui/PageHeader";
import { Table, Thead, Th, Tbody, Tr, Td } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";

const PAGE_SIZE = 20;

const INV_STATUS: Record<string, { label: string; variant: "success" | "danger" | "warning" | "gray" | "default" | "info" }> = {
  DRAFT: { label: "مسودة", variant: "gray" },
  ISSUED: { label: "صادرة", variant: "info" },
  PARTIAL: { label: "جزئي", variant: "warning" },
  PAID: { label: "مدفوعة", variant: "success" },
  VOID: { label: "ملغاة", variant: "danger" },
};

export default async function BillingPage({ searchParams }: { searchParams: { page?: string; status?: string; q?: string } }) {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role === "RECEPTIONIST") redirect("/dashboard");

  const page = parseInt(searchParams.page ?? "1");
  const skip = (page - 1) * PAGE_SIZE;
  const statusFilter = searchParams.status ?? "";
  const q = searchParams.q ?? "";

  const where = {
    ...(statusFilter ? { status: statusFilter as never } : {}),
    ...(q ? { patient: { fullName: { contains: q } } } : {}),
  };

  const [invoices, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      include: {
        patient: { select: { id: true, fullName: true } },
        billingCycle: { select: { cycleNumber: true, program: { select: { service: { select: { name: true } } } } } },
        program: { select: { service: { select: { name: true } } } },
        standaloneSession: { select: { service: { select: { name: true } } } },
        payments: { select: { amount: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: PAGE_SIZE,
    }),
    prisma.invoice.count({ where }),
  ]);

  // Summary stats
  const [ledger, collected] = await Promise.all([
    getAccountBalances(new Date()),
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: { paymentDate: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } },
    }),
  ]);

  // Receipts are posted to accounts, so what is owed is read from the patient accounts
  const outstandingAmount = ledger.totals.receivable;
  const collectedMonth = Number(collected._sum.amount ?? 0);

  return (
    <div>
      <PageHeader
        title="الفواتير والمدفوعات"
        action={<Link href="/billing/new" className="btn-primary">+ فاتورة جديدة</Link>}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
        <div className="card p-4">
          <p className="text-xs text-gray-500">المستحق</p>
          <p className="text-xl font-bold text-red-600 mt-1">{outstandingAmount.toLocaleString("en-US")} ر.س</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500">محصّل هذا الشهر</p>
          <p className="text-xl font-bold text-green-600 mt-1">{collectedMonth.toLocaleString("en-US")} ر.س</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500">إجمالي الفواتير</p>
          <p className="text-xl font-bold text-gray-800 mt-1">{total}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4">
        <form method="get" className="flex gap-2">
          <input name="q" defaultValue={q} placeholder="بحث بالاسم..." className="input max-w-xs" />
          <select name="status" defaultValue={statusFilter} className="input max-w-[160px]">
            <option value="">جميع الحالات</option>
            <option value="DRAFT">مسودة</option>
            <option value="ISSUED">صادرة</option>
            <option value="PARTIAL">جزئي</option>
            <option value="PAID">مدفوعة</option>
            <option value="VOID">ملغاة</option>
          </select>
          <button type="submit" className="btn-secondary">بحث</button>
        </form>
      </div>

      <div className="card">
        {invoices.length === 0 ? (
          <EmptyState title="لا توجد فواتير" action={<Link href="/billing/new" className="btn-primary">+ فاتورة جديدة</Link>} />
        ) : (
          <Table>
            <Thead>
              <tr>
                <Th>المريض</Th>
                <Th>الخدمة</Th>
                <Th>المبلغ</Th>
                <Th>تاريخ الإصدار</Th>
                <Th>الحالة</Th>
                <Th />
              </tr>
            </Thead>
            <Tbody>
              {invoices.map((inv) => {
                const st = INV_STATUS[inv.status] ?? { label: inv.status, variant: "gray" };
                return (
                  <Tr key={inv.id}>
                    <Td>
                      <Link href={`/patients/${inv.patient.id}`} className="text-primary-600 hover:underline font-medium">
                        {inv.patient.fullName}
                      </Link>
                    </Td>
                    <Td>
                      {inv.program
                        ? `برنامج — ${inv.program.service.name}`
                        : inv.standaloneSession
                        ? `جلسة — ${inv.standaloneSession.service.name}`
                        : inv.billingCycle?.program.service.name ?? "فاتورة يدوية"}
                    </Td>
                    <Td dir="ltr" className="text-sm">{Number(inv.totalAmount).toLocaleString("en-US")} ر.س</Td>
                    <Td>{format(new Date(inv.issueDate), "d MMM yyyy", { locale: arSA })}</Td>
                    <Td><Badge variant={st.variant}>{st.label}</Badge></Td>
                    <Td>
                      <Link href={`/billing/${inv.id}`} className="text-primary-600 hover:underline text-xs">عرض</Link>
                    </Td>
                  </Tr>
                );
              })}
            </Tbody>
          </Table>
        )}
      </div>

      <Pagination total={total} pageSize={PAGE_SIZE} />
    </div>
  );
}
