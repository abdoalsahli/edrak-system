"use client";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

export function Pagination({
  total,
  pageSize = 20,
  // legacy support
  page: pageProp,
  perPage,
}: {
  total: number;
  pageSize?: number;
  page?: number;
  perPage?: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const effectivePerPage = pageSize ?? perPage ?? 20;
  const page = pageProp ?? Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const totalPages = Math.ceil(total / effectivePerPage);

  if (totalPages <= 1) return null;

  function goTo(p: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(p));
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
      <span>
        عرض {Math.min((page - 1) * effectivePerPage + 1, total)}–{Math.min(page * effectivePerPage, total)} من {total}
      </span>
      <div className="flex gap-1">
        <button
          onClick={() => goTo(page - 1)}
          disabled={page === 1}
          className="px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          السابق
        </button>
        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
          const p = Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
          return (
            <button
              key={p}
              onClick={() => goTo(p)}
              className={`px-3 py-1.5 rounded-lg border ${
                p === page
                  ? "bg-primary-600 text-white border-primary-600"
                  : "border-gray-200 hover:bg-gray-50"
              }`}
            >
              {p}
            </button>
          );
        })}
        <button
          onClick={() => goTo(page + 1)}
          disabled={page === totalPages}
          className="px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          التالي
        </button>
      </div>
    </div>
  );
}
