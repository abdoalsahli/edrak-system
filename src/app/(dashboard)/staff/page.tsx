import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Stethoscope, UserPlus } from "lucide-react";
import type { UserRole } from "@/lib/enums";
import { PageHeader } from "@/components/ui/PageHeader";
import { Table, Thead, Th, Tbody, Tr, Td } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils";

const ROLE_LABEL: Record<UserRole, string> = {
  MANAGER: "مدير",
  RECEPTIONIST: "موظف استقبال",
  ACCOUNTANT: "محاسب",
  THERAPIST: "أخصائي",
};

type Row = {
  key: string;
  href: string;
  name: string;
  kind: "therapist" | "employee";
  title: string | null;
  phone: string | null;
  isActive: boolean;
  login: { role: UserRole | string; isActive: boolean } | null;
};

const FILTERS = [
  { value: "", label: "الكل" },
  { value: "therapists", label: "المعالجون" },
  { value: "employees", label: "الموظفون الإداريون" },
] as const;

/** الموظفون — therapists and the rest of the staff in one list, with their user accounts. */
export default async function StaffPage({ searchParams }: { searchParams: { type?: string } }) {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "MANAGER") redirect("/dashboard");
  const type = searchParams.type === "therapists" || searchParams.type === "employees" ? searchParams.type : "";

  const loginSelect = { select: { role: true, isActive: true } } as const;
  const [therapists, employees] = await Promise.all([
    prisma.therapist.findMany({ orderBy: { fullName: "asc" }, include: { user: loginSelect } }),
    prisma.employee.findMany({ orderBy: { fullName: "asc" }, include: { user: loginSelect } }),
  ]);

  const all: Row[] = [
    ...therapists.map((t): Row => ({
      key: "t" + t.id, href: `/therapists/${t.id}`, name: t.fullName, kind: "therapist",
      title: t.specialty, phone: t.phone, isActive: t.isActive, login: t.user,
    })),
    ...employees.map((e): Row => ({
      key: "e" + e.id, href: `/staff/${e.id}`, name: e.fullName, kind: "employee",
      title: e.jobTitle, phone: e.phone, isActive: e.isActive, login: e.user,
    })),
  ].sort((a, b) => a.name.localeCompare(b.name, "ar"));

  const rows = all.filter((r) => !type || (type === "therapists" ? r.kind === "therapist" : r.kind === "employee"));
  const count = (k: string) => (k === "" ? all.length : all.filter((r) => (k === "therapists") === (r.kind === "therapist")).length);

  return (
    <div>
      <PageHeader
        title="الموظفون"
        description={`${therapists.length} معالج · ${employees.length} موظف إداري`}
        action={
          <div className="flex gap-2">
            <Link href="/therapists/new" className="btn-secondary"><Stethoscope className="size-4" />إضافة معالج</Link>
            <Link href="/staff/new" className="btn-primary"><UserPlus className="size-4" />إضافة موظف</Link>
          </div>
        }
      />

      <div className="mb-4 flex gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={f.value ? `/staff?type=${f.value}` : "/staff"}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-medium transition",
              type === f.value ? "bg-primary-600 text-white" : "bg-white text-gray-600 shadow-card hover:text-primary-600",
            )}
          >
            {f.label} <span className="opacity-70">({count(f.value)})</span>
          </Link>
        ))}
      </div>

      <div className="card">
        {rows.length === 0 ? (
          <EmptyState
            title="لا يوجد موظفون"
            action={<Link href="/staff/new" className="btn-primary">إضافة موظف</Link>}
          />
        ) : (
          <Table>
            <Thead>
              <tr>
                <Th>الاسم</Th>
                <Th>النوع</Th>
                <Th>التخصص / الوظيفة</Th>
                <Th>الهاتف</Th>
                <Th>حساب المستخدم</Th>
                <Th>الحالة</Th>
                <Th></Th>
              </tr>
            </Thead>
            <Tbody>
              {rows.map((r) => (
                <Tr key={r.key}>
                  <Td className="font-medium text-gray-900">{r.name}</Td>
                  <Td>
                    <Badge variant={r.kind === "therapist" ? "info" : "default"}>
                      {r.kind === "therapist" ? "معالج" : "إداري"}
                    </Badge>
                  </Td>
                  <Td>{r.title ?? "—"}</Td>
                  <Td dir="ltr">{r.phone ?? "—"}</Td>
                  <Td>
                    {r.login ? (
                      <span className={cn("text-sm", r.login.isActive ? "text-gray-700" : "text-gray-400 line-through")}>
                        {ROLE_LABEL[r.login.role as UserRole]}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">بدون حساب</span>
                    )}
                  </Td>
                  <Td>
                    <Badge variant={r.isActive ? "success" : "gray"}>{r.isActive ? "نشط" : "غير نشط"}</Badge>
                  </Td>
                  <Td>
                    <Link href={r.href} className="text-primary-600 hover:underline text-xs">عرض / تعديل</Link>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </div>
    </div>
  );
}
