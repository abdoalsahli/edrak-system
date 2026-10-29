"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileText, Receipt } from "lucide-react";

const money = (n: number) => `${Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 2 })} د.ل`;

/**
 * The money side of a program or a session, the current-accounts way: what it
 * put on the patient's account, and the account's balance today. Payments are
 * receipts on the account — never on the program or its invoice — so there is
 * no «paid / remaining» per program. Hidden from those who may not see money.
 */
export function PatientAccountCard({ patientId, charged, chargedLabel, chargedHint }: {
  patientId: string;
  charged: number;
  chargedLabel: string;
  chargedHint?: string;
}) {
  const [balance, setBalance] = useState<number | null | "hidden">(null);
  useEffect(() => {
    fetch(`/api/patients/${patientId}/balance`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setBalance(d ? d.balance : "hidden"));
  }, [patientId]);

  if (balance === "hidden") return null;
  const owes = typeof balance === "number" && balance > 0.005;
  const credit = typeof balance === "number" && balance < -0.005;

  return (
    <section className="card p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-gray-800">الحساب المالي</h2>
        <div className="flex gap-2">
          <Link href={`/patients/${patientId}/statement`} className="btn-secondary text-sm"><FileText className="size-4" />كشف حساب المريض</Link>
          <Link href="/finance/receipts" className="btn-primary text-sm"><Receipt className="size-4" />سند قبض</Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl bg-gray-50 p-4">
          <p className="text-sm text-gray-500">{chargedLabel}</p>
          <p className="mt-1 text-2xl font-bold text-gray-800">{money(charged)}</p>
          {chargedHint && <p className="mt-1 text-xs text-gray-400">{chargedHint}</p>}
        </div>
        <div className={`rounded-2xl p-4 ${owes ? "bg-red-50" : credit ? "bg-green-50" : "bg-gray-50"}`}>
          <p className="text-sm text-gray-500">
            {owes ? "رصيد حساب المريض — مستحق عليه" : credit ? "رصيد حساب المريض — لصالحه" : "رصيد حساب المريض"}
          </p>
          <p className={`mt-1 text-2xl font-bold ${owes ? "text-red-600" : credit ? "text-green-600" : "text-gray-800"}`}>
            {balance === null ? "…" : money(balance)}
          </p>
          <p className="mt-1 text-xs text-gray-400">لكل برامجه وجلساته معاً، بعد خصم كل ما دفعه</p>
        </div>
      </div>

      <p className="mt-4 text-xs text-gray-500">
        الدفعات تُسجَّل بسندات قبض على حساب المريض الجاري، ولا ترتبط ببرنامج أو فاتورة بعينها — لذلك يُتابَع التحصيل من رصيد الحساب.
      </p>
    </section>
  );
}
