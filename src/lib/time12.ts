/**
 * Times are stored as 24-hour "HH:mm"; people read them on a 12-hour clock:
 * "15:00" → "3:00 م", "09:30" → "9:30 ص", "12:00" → "12:00 م", "00:15" → "12:15 ص".
 * Each result is wrapped in a right-to-left isolate (RLI … PDI), so it reads «5:00 م»
 * — number first, then ص/م — even inside a dir="ltr" element, a table cell or a tooltip.
 */
const RLI = "⁧";
const PDI = "⁩";
const rtl = (text: string) => RLI + text + PDI;

export function to12(t: string | null | undefined): string {
  if (!t) return "—";
  const [h, m] = t.split(":").map(Number);
  if (Number.isNaN(h)) return t;
  const suffix = h < 12 ? "ص" : "م";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return rtl(`${h12}:${String(m || 0).padStart(2, "0")} ${suffix}`);
}

/** "15:00","16:00" → "3:00 م – 4:00 م" */
export const range12 = (start: string | null | undefined, end: string | null | undefined) => rtl(`${to12(start)} – ${to12(end)}`);

/** An hour of the day for grid labels: 15 → "3 م", 0 → "12 ص". */
export function hour12(h: number): string {
  return rtl(`${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? "ص" : "م"}`);
}
