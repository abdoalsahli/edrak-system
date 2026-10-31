"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Kind = "PATIENT" | "THERAPIST" | "EXPENSE" | "CUSTOM" | "CASH";
type Nature = "DEBIT" | "CREDIT";

export type AccountOption = { id: string; code: string; name: string; kind: Kind; nature: Nature; balance?: number };

const KIND_GROUP: Record<Kind, string> = {
  PATIENT: "الحالات",
  THERAPIST: "الأخصائيون",
  EXPENSE: "المصروفات",
  CUSTOM: "حسابات عامة",
  CASH: "الصناديق والبنوك",
};
const KIND_ORDER: Kind[] = ["PATIENT", "THERAPIST", "EXPENSE", "CUSTOM", "CASH"];

/** Arabic-insensitive text for searching: أ إ آ → ا، ة → ه، ى → ي، no tashkeel or tatweel. */
const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[ً-ْـ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/\s+/g, " ")
    .trim();

/** Every word typed must appear in the name or the code, in any order. */
function matches(a: AccountOption, query: string) {
  const hay = normalize(`${a.name} ${a.code}`);
  return normalize(query).split(" ").every((w) => hay.includes(w));
}

/**
 * Account picker: one field — type part of a name or a code and pick from the
 * list under it (mouse, or ↑ ↓ and Enter). Grouped by kind; the chosen account
 * shows with a ✕ to clear it.
 */
export function AccountSelect({
  accounts, value, onChange, exclude = [], kinds, required, placeholder = "— اختر الحساب —",
}: {
  accounts: AccountOption[];
  value: string;
  onChange: (id: string) => void;
  exclude?: string[];
  kinds?: Kind[];
  required?: boolean;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();

  const selected = accounts.find((a) => a.id === value) ?? null;

  // Filtered and in group order, so ↑ ↓ walk the list as it is shown
  const options = useMemo(
    () =>
      KIND_ORDER.flatMap((k) =>
        accounts.filter(
          (a) => a.kind === k && !exclude.includes(a.id) && (!kinds || kinds.includes(a.kind)) && (!query || matches(a, query)),
        ),
      ),
    [accounts, exclude, kinds, query],
  );

  // Close when clicking elsewhere
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) { setOpen(false); setQuery(""); }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Keep the highlighted row in view
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  function choose(a: AccountOption) {
    onChange(a.id);
    setOpen(false);
    setQuery("");
  }

  function openList() {
    setOpen(true);
    setActive(Math.max(0, options.findIndex((o) => o.id === value)));
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) { openList(); return; }
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((i) => (options.length ? (i + step + options.length) % options.length : 0));
    } else if (e.key === "Enter") {
      if (open && options[active]) { e.preventDefault(); choose(options[active]); }
    } else if (e.key === "Escape") {
      if (open) { e.preventDefault(); e.stopPropagation(); setOpen(false); setQuery(""); }
    } else if (e.key === "Tab") {
      setOpen(false); setQuery("");
    }
  }

  let lastKind: Kind | null = null;

  return (
    <div ref={boxRef} className="relative">
      <div
        className={cn(
          "input flex cursor-text items-center gap-2 pe-2",
          open && "ring-2 ring-primary-600",
        )}
        onClick={() => { inputRef.current?.focus(); if (!open) openList(); }}
      >
        <Search className="size-4 shrink-0 text-gray-400" />
        <input
          ref={inputRef}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          value={open ? query : selected ? `${selected.name}` : ""}
          onChange={(e) => { setQuery(e.target.value); setActive(0); if (!open) setOpen(true); }}
          onFocus={() => { if (!open) openList(); }}
          onKeyDown={onKeyDown}
          placeholder={selected ? `${selected.name} — اكتب للبحث` : placeholder === "—" ? "اكتب اسم الحساب أو رمزه" : placeholder}
          className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-gray-400"
        />
        {selected && !open && <span className="shrink-0 font-mono text-xs text-gray-400" dir="ltr">{selected.code}</span>}
        {selected ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onChange(""); setQuery(""); inputRef.current?.focus(); }}
            className="shrink-0 rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            title="إزالة الاختيار"
          >
            <X className="size-4" />
          </button>
        ) : (
          <ChevronDown className="size-4 shrink-0 text-gray-400" />
        )}
      </div>

      {/* Lets the form's own validation require a choice */}
      {required && (
        <input
          tabIndex={-1}
          aria-hidden
          required
          value={value}
          onChange={() => undefined}
          onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity("اختر الحساب من القائمة")}
          onInput={(e) => (e.target as HTMLInputElement).setCustomValidity("")}
          className="pointer-events-none absolute bottom-0 start-4 h-px w-px opacity-0"
        />
      )}

      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-50 mt-1 max-h-72 overflow-y-auto rounded-2xl border border-gray-200 bg-white py-1 shadow-card"
        >
          {options.length === 0 ? (
            <li className="px-4 py-3 text-center text-sm text-gray-400">لا يوجد حساب بهذا الاسم أو الرمز</li>
          ) : (
            options.map((a, i) => {
              const header = a.kind !== lastKind ? KIND_GROUP[a.kind] : null;
              lastKind = a.kind;
              return (
                <li key={a.id} role="presentation">
                  {header && (
                    <p className="sticky top-0 bg-gray-50/95 px-4 py-1 text-xs font-medium text-gray-500">{header}</p>
                  )}
                  <div
                    role="option"
                    aria-selected={a.id === value}
                    data-index={i}
                    onMouseDown={(e) => { e.preventDefault(); choose(a); }}
                    onMouseEnter={() => setActive(i)}
                    className={cn(
                      "flex cursor-pointer items-center justify-between gap-3 px-4 py-2 text-sm",
                      i === active ? "bg-primary-50 text-primary-700" : "text-gray-700",
                      a.id === value && "font-semibold",
                    )}
                  >
                    <span className="truncate">{a.name}</span>
                    <span className="flex shrink-0 items-center gap-3">
                      {a.balance !== undefined && (
                        <span className="text-xs text-gray-400">{a.balance.toLocaleString("en-US", { maximumFractionDigits: 2 })}</span>
                      )}
                      <span className="font-mono text-xs text-gray-400" dir="ltr">{a.code}</span>
                    </span>
                  </div>
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}
