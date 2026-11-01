"use client";

import { WEEK_ORDER } from "@/lib/week";

/** Default programme length: the total follows sessions-per-week × 4 weeks. */
export const WEEKS_PER_PROGRAM = 4;

export const DAY_AR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

/** Arabic count of days: يوماً واحداً / يومين / 3 أيام / 11 يوماً */
export const daysAr = (n: number) => (n === 1 ? "يوماً واحداً" : n === 2 ? "يومين" : n <= 10 ? `${n} أيام` : `${n} يوماً`);

/** The chosen days must be exactly as many as the sessions per week. */
export const daysMatch = (allowedDays: number[], sessionsPerWeek: number) => allowedDays.length === sessionsPerWeek;

export const daysMismatchMessage = (sessionsPerWeek: number) => `اختر ${daysAr(sessionsPerWeek)} بعدد الجلسات الأسبوعية`;

/**
 * Weekly rhythm of a programme: sessions per week, total sessions (follows
 * per-week × 4 weeks, still editable) and the session days, which must match
 * the weekly count. Shared by «برنامج جديد» and «تمديد البرنامج».
 * Renders two grid cells (per week, total) followed by a full-width day picker.
 */
export function ScheduleRhythmFields({
  sessionsPerWeek,
  onSessionsPerWeek,
  totalSessions,
  onTotalSessions,
  allowedDays,
  onAllowedDays,
  totalLabel = "إجمالي الجلسات",
  totalFixed = false,
}: {
  sessionsPerWeek: number;
  onSessionsPerWeek: (n: number) => void;
  totalSessions: number;
  onTotalSessions: (n: number) => void;
  allowedDays: number[];
  onAllowedDays: (days: number[]) => void;
  totalLabel?: string;
  /** The count is given (rescheduling the remaining sessions): show it, never derive it. */
  totalFixed?: boolean;
}) {
  const matched = daysMatch(allowedDays, sessionsPerWeek);
  const missing = sessionsPerWeek - allowedDays.length;

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">جلسات في الأسبوع</label>
          <input
            type="number" min={1} max={7} value={sessionsPerWeek}
            onChange={(e) => {
              const n = parseInt(e.target.value);
              onSessionsPerWeek(n);
              // Four weeks by default; the total can still be edited by hand
              if (n > 0 && !totalFixed) onTotalSessions(n * WEEKS_PER_PROGRAM);
            }}
            className="input" dir="ltr"
          />
        </div>
        <div>
          <label className="label">{totalLabel}</label>
          <input
            type="number" min={1} value={totalSessions} readOnly={totalFixed}
            onChange={(e) => onTotalSessions(parseInt(e.target.value))}
            className={`input ${totalFixed ? "bg-gray-50 text-gray-600" : ""}`} dir="ltr"
          />
          {!totalFixed && sessionsPerWeek > 0 && totalSessions === sessionsPerWeek * WEEKS_PER_PROGRAM && (
            <p className="text-xs text-gray-400 mt-1">{sessionsPerWeek} × {WEEKS_PER_PROGRAM} أسابيع</p>
          )}
        </div>
      </div>

      <div>
        <label className="label">
          أيام الجلسات <span className="text-red-500">*</span>
          <span className="text-xs font-normal text-gray-400 ms-2">اختر {daysAr(sessionsPerWeek)}</span>
        </label>
        <div className="flex gap-2 flex-wrap">
          {WEEK_ORDER.map((i) => {
            const name = DAY_AR[i];
            const selected = allowedDays.includes(i);
            // Once the weekly count is reached, the other days lock until one is unselected
            const locked = !selected && allowedDays.length >= sessionsPerWeek;
            return (
              <button
                key={i}
                type="button"
                disabled={locked}
                onClick={() => onAllowedDays(selected ? allowedDays.filter((d) => d !== i) : [...allowedDays, i].sort())}
                className={`rounded-[1.5rem] border px-4 py-2 text-sm font-medium transition-colors ${
                  selected
                    ? "bg-primary-600 text-white border-primary-600"
                    : locked
                      ? "bg-gray-50 text-gray-300 border-gray-200 cursor-not-allowed"
                      : "bg-white text-gray-600 border-gray-300 hover:border-primary-400"
                }`}
              >
                {name}
              </button>
            );
          })}
        </div>
        {!matched && sessionsPerWeek > 0 && (
          <p className="text-xs text-red-500 mt-1">
            {missing > 0
              ? `اختر ${daysAr(missing)} ${{ 1: "آخر", 2: "آخرين" }[missing] ?? "أخرى"} (المحدد ${allowedDays.length} من ${sessionsPerWeek})`
              : `عدد الأيام المحددة (${allowedDays.length}) أكثر من الجلسات الأسبوعية (${sessionsPerWeek}) — ألغِ تحديد ${daysAr(-missing)}`}
          </p>
        )}
      </div>
    </>
  );
}
