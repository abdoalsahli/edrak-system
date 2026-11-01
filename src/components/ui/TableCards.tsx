"use client";

import { useEffect } from "react";

/**
 * Tables as cards on phones. Every table in the page gets its cells labelled
 * with their column header (data-label), and the CSS in globals.css lays each
 * row out as a card below the md breakpoint: the first cell is the card's
 * title, the others show «header: value». Wider screens keep the tables.
 *
 * Works for server- and client-rendered tables alike (a MutationObserver
 * relabels what React renders later). A table opts out with data-keep-table.
 *
 * A header can give its column a role in the card (data-card="title" | "amount"
 * | "meta"): the title and the amount share the first line, the meta columns
 * follow on one small line, and the other columns keep «header: value» rows.
 */
function label(table: HTMLTableElement) {
  if (table.hasAttribute("data-keep-table")) return;
  const headRow = table.tHead?.rows[table.tHead.rows.length - 1];
  if (!headRow) return;

  // Header texts by column, expanding colspans. A header can also mark its
  // column as desktop-only (data-hide-mobile) or phone-only (data-show-mobile).
  const headers: string[] = [];
  const hide: boolean[] = [];
  const show: boolean[] = [];
  const role: (string | null)[] = [];
  for (const th of Array.from(headRow.cells)) {
    for (let k = 0; k < th.colSpan; k++) {
      headers.push(th.textContent?.trim() ?? "");
      hide.push(th.hasAttribute("data-hide-mobile"));
      show.push(th.hasAttribute("data-show-mobile"));
      role.push(th.getAttribute("data-card"));
    }
  }

  const rows = [...Array.from(table.tBodies).flatMap((b) => Array.from(b.rows)), ...(table.tFoot ? Array.from(table.tFoot.rows) : [])];
  for (const tr of rows) {
    let col = 0;
    const cells = Array.from(tr.cells);
    // A row whose cell spans several columns (a note, a subtotal) is shown whole
    tr.toggleAttribute("data-span", cells.some((c) => c.colSpan > 1));
    cells.forEach((td, i) => {
      const h = headers[col] ?? "";
      if (i > 0 && h && td.colSpan === 1) td.setAttribute("data-label", h);
      else td.removeAttribute("data-label");
      td.toggleAttribute("data-hide-mobile", td.colSpan === 1 && !!hide[col]);
      td.toggleAttribute("data-show-mobile", td.colSpan === 1 && !!show[col]);
      const r = td.colSpan === 1 ? role[col] : null;
      if (r) td.setAttribute("data-card", r);
      else td.removeAttribute("data-card");
      col += td.colSpan;
    });
  }
  table.toggleAttribute("data-card-layout", role.some(Boolean));
  table.classList.add("cards-ready");
}

export function TableCards() {
  useEffect(() => {
    // setTimeout, not requestAnimationFrame: frames do not run in a hidden tab
    let pending: ReturnType<typeof setTimeout> | null = null;
    const run = () => {
      pending = null;
      document.querySelectorAll<HTMLTableElement>("main table").forEach(label);
    };
    run();
    const observer = new MutationObserver(() => {
      if (!pending) pending = setTimeout(run, 50);
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => {
      observer.disconnect();
      if (pending) clearTimeout(pending);
    };
  }, []);
  return null;
}
