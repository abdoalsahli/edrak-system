"use client";

import { useState } from "react";
import { DAY_AR } from "./ScheduleRhythmFields";
import { WEEK_ORDER, weekIndex } from "@/lib/week";
import { Info, AlertTriangle } from "lucide-react";
import { to12 } from "@/lib/time12";

export type ProposedApt = { date: string; startTime: string; endTime: string; sequenceNumber: number };

const MONTH_AR = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

/** «الأحد، 18 أكتوبر 2026» */
export function fmtDateAr(d: string) {
  const dt = new Date(d);
  return `${DAY_AR[dt.getDay()]}، ${dt.getDate()} ${MONTH_AR[dt.getMonth()]} ${dt.getFullYear()}`;
}

function addMins(t: string, m: number) {
  const [h, mn] = t.split(":").map(Number);
  const total = h * 60 + mn + m;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function buildMonthGrid(monthKey: string) {
  const [y, m] = monthKey.split("-").map(Number);
  const firstDay = new Date(y, m - 1, 1);
  const lastDay = new Date(y, m, 0);
  // From the Saturday of the first week to the Friday of the last
  const start = new Date(firstDay);
  start.setDate(firstDay.getDate() - weekIndex(firstDay.getDay()));
  const end = new Date(lastDay);
  end.setDate(lastDay.getDate() + (6 - weekIndex(lastDay.getDay())));
  const cells: Date[] = [];
  for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) cells.push(new Date(d));
  return { cells, firstDay };
}

/**
 * Month-by-month preview of a proposed schedule. Click a session's time to edit
 * it, × to drop it; the rest are renumbered from `firstSequence` (1 for a new
 * programme, the next number for an extension).
 */
export function ScheduleCalendar({
  proposed,
  onChange,
  durationMin,
  firstSequence = 1,
  allowRemove = true,
}: {
  proposed: ProposedApt[];
  onChange: (next: ProposedApt[]) => void;
  durationMin: number;
  firstSequence?: number;
  /** Off when every slot belongs to an existing session (rescheduling). */
  allowRemove?: boolean;
}) {
  const [editSeq, setEditSeq] = useState<number | null>(null);

  const monthKeys = [...new Set(proposed.map((a) => a.date.slice(0, 7)))].sort();
  const dateMap = new Map(proposed.map((a) => [a.date, a]));

  const updateTime = (seq: number, start: string) =>
    onChange(proposed.map((a) => (a.sequenceNumber === seq ? { ...a, startTime: start, endTime: addMins(start, durationMin) } : a)));
  const remove = (seq: number) =>
    onChange(proposed.filter((a) => a.sequenceNumber !== seq).map((a, i) => ({ ...a, sequenceNumber: firstSequence + i })));

  return (
    <>
      <div className="space-y-5">
        {monthKeys.map((mk) => {
          const { cells, firstDay } = buildMonthGrid(mk);
          const sessionsInMonth = proposed.filter((a) => a.date.startsWith(mk)).length;
          return (
            <div key={mk} className="card overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                <span className="font-semibold text-gray-700">{MONTH_AR[firstDay.getMonth()]} {firstDay.getFullYear()}</span>
                <span className="text-xs text-gray-400 bg-white px-2 py-0.5 rounded-full border border-gray-200">{sessionsInMonth} جلسة</span>
              </div>

              <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50/50">
                {WEEK_ORDER.map((i) => DAY_AR[i]).map((d) => (
                  <div key={d} className="text-center py-1.5 text-xs font-medium text-gray-400">{d.slice(0, 3)}</div>
                ))}
              </div>

              <div className="grid grid-cols-7">
                {cells.map((cell, idx) => {
                  const iso = `${cell.getFullYear()}-${String(cell.getMonth() + 1).padStart(2, "0")}-${String(cell.getDate()).padStart(2, "0")}`;
                  const apt = dateMap.get(iso);
                  const inMonth = cell.getMonth() === firstDay.getMonth();
                  return (
                    <div
                      key={idx}
                      className={`min-h-[72px] border-l border-b border-gray-100 p-1.5 ${!inMonth ? "bg-gray-50/60" : ""} ${apt ? "bg-primary-50/40" : ""}`}
                    >
                      <div className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mb-1 ${
                        apt ? "bg-primary-600 text-white" : inMonth ? "text-gray-600" : "text-gray-300"
                      }`}>
                        {cell.getDate()}
                      </div>
                      {apt && (
                        <div>
                          {editSeq === apt.sequenceNumber ? (
                            <div className="space-y-0.5">
                              <input
                                type="time"
                                value={apt.startTime}
                                onChange={(e) => updateTime(apt.sequenceNumber, e.target.value)}
                                className="w-full text-xs border border-primary-300 rounded px-1 py-0.5 bg-white"
                                dir="ltr"
                                autoFocus
                                onBlur={() => setEditSeq(null)}
                              />
                              <div className="text-xs text-gray-400 text-center">{to12(apt.endTime)}</div>
                            </div>
                          ) : (
                            <button type="button" className="w-full text-start" onClick={() => setEditSeq(apt.sequenceNumber)} title="انقر لتعديل الوقت">
                              <div className="text-xs font-medium text-primary-700 leading-tight">{to12(apt.startTime)}</div>
                              <div className="text-xs text-gray-400 leading-tight">{to12(apt.endTime)}</div>
                              <div className="text-xs text-gray-400">#{apt.sequenceNumber}</div>
                            </button>
                          )}
                          {allowRemove && <button
                            type="button"
                            onClick={() => remove(apt.sequenceNumber)}
                            className="text-gray-300 hover:text-red-400 text-xs leading-none float-left mt-0.5"
                            title="حذف"
                          >×</button>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-xs text-gray-400"><Info className="size-3.5" />انقر على وقت الجلسة لتعديله{allowRemove ? "، أو على × لحذفها" : ""}</p>
    </>
  );
}

/** Warnings shown above the calendar: conflicts skipped, and a schedule shorter than asked. */
export function ScheduleWarnings({ conflicts, generated, requested }: { conflicts: string[]; generated: number; requested: number }) {
  return (
    <>
      {conflicts.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-4">
          <p className="font-medium text-yellow-800 mb-1"><AlertTriangle className="inline size-4 align-[-3px]" /> تعارضات تم تجاوزها ({conflicts.length})</p>
          <ul className="text-sm text-yellow-700 space-y-0.5 max-h-28 overflow-y-auto">
            {conflicts.map((c, i) => <li key={i}>• {c}</li>)}
          </ul>
        </div>
      )}
      {generated < requested && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 text-sm text-red-700">
          <AlertTriangle className="inline size-4 align-[-3px]" /> تم توليد <strong>{generated}</strong> جلسة من أصل <strong>{requested}</strong> — قد تحتاج لتعديل الإعدادات أو إضافة توفّر للمعالج.
        </div>
      )}
    </>
  );
}
