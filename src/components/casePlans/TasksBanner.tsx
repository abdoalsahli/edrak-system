"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ClipboardList } from "lucide-react";
import type { CaseTask, ReviewItem } from "@/lib/casePlans/CycleService";

/**
 * A reminder line on the home screen: plans and reports waiting for this
 * therapist, or — for the manager — waiting for review and overdue.
 */
export function TasksBanner({ mode }: { mode: "therapist" | "manager" }) {
  const [data, setData] = useState<{ tasks: CaseTask[]; reviews: ReviewItem[] } | null>(null);
  useEffect(() => {
    fetch("/api/case-plans/tasks").then((r) => (r.ok ? r.json() : null)).then(setData);
  }, []);
  if (!data) return null;

  const late = data.tasks.filter((t) => t.late).length;
  const parts =
    mode === "therapist"
      ? [data.tasks.length && `${data.tasks.length} مطلوب منك`, late && `${late} متأخر`]
      : [data.reviews.length && `${data.reviews.length} بانتظار مراجعتك`, late && `${late} متأخر عند الأخصائيين`];
  const text = parts.filter(Boolean).join(" · ");
  if (!text) return null;

  return (
    <Link
      href={mode === "therapist" ? "/my/plans" : "/case-plans"}
      className="mb-6 flex items-center gap-3 rounded-card bg-primary-50 px-5 py-3 text-sm text-primary-700 transition hover:bg-primary-100 print:hidden"
    >
      <ClipboardList className="size-5 shrink-0" />
      <span className="font-medium">الخطط والتقارير:</span>
      <span>{text}</span>
      <span className="ms-auto text-xs font-medium">عرض</span>
    </Link>
  );
}
