/**
 * A small smooth line / area chart in plain SVG (no chart library).
 * Points run right-to-left for an RTL page: the first label sits on the right.
 */
export type ChartSeries = { label: string; color: string; values: number[]; fill?: boolean };

const W = 640;
const H = 240;
const PAD = { top: 12, right: 8, bottom: 28, left: 52 };

function niceMax(v: number) {
  if (v <= 0) return 100;
  const mag = 10 ** Math.floor(Math.log10(v));
  return Math.ceil((v * 1.1) / mag) * mag;
}

/**
 * Catmull-Rom → cubic Bézier, for a soft curve through every point. Control points
 * are kept within each segment's own range so the curve never overshoots
 * (e.g. never dips below zero after a sharp drop).
 */
function smoothPath(pts: [number, number][]) {
  if (pts.length < 2) return "";
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const lo = Math.min(p1[1], p2[1]);
    const hi = Math.max(p1[1], p2[1]);
    const clamp = (v: number) => Math.min(hi, Math.max(lo, v));
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, clamp(p1[1] + (p2[1] - p0[1]) / 6)];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, clamp(p2[1] - (p3[1] - p1[1]) / 6)];
    d += ` C ${c1[0]} ${c1[1]}, ${c2[0]} ${c2[1]}, ${p2[0]} ${p2[1]}`;
  }
  return d;
}

export function AreaChart({ labels, series, format = (n) => n.toLocaleString("en-US") }: {
  labels: string[];
  series: ChartSeries[];
  format?: (n: number) => string;
}) {
  const max = niceMax(Math.max(0, ...series.flatMap((s) => s.values)));
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const n = labels.length;
  // RTL: index 0 on the right
  const x = (i: number) => PAD.left + (n === 1 ? innerW / 2 : innerW - (i * innerW) / (n - 1));
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-4 text-xs text-gray-500">
        {series.map((s) => (
          <span key={s.label} className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-full" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={series.map((s) => s.label).join("، ")}>
        <defs>
          {series.map((s, i) => (
            <linearGradient key={i} id={`area-${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity="0.28" />
              <stop offset="100%" stopColor={s.color} stopOpacity="0.02" />
            </linearGradient>
          ))}
        </defs>

        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="#DFE5ED" strokeDasharray="3 4" />
            <text x={PAD.left - 10} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#7786A5">{format(t)}</text>
          </g>
        ))}
        {labels.map((l, i) => (
          <text key={i} x={x(i)} y={H - 6} textAnchor="middle" fontSize="11" fill="#7786A5">{l}</text>
        ))}

        {series.map((s, si) => {
          const pts = s.values.map((v, i) => [x(i), y(v)] as [number, number]);
          const line = smoothPath(pts);
          const area = s.fill && pts.length > 1
            ? `${line} L ${pts[pts.length - 1][0]} ${y(0)} L ${pts[0][0]} ${y(0)} Z`
            : null;
          return (
            <g key={si}>
              {area && <path d={area} fill={`url(#area-${si})`} />}
              <path d={line} fill="none" stroke={s.color} strokeWidth={s.fill ? 3 : 2.5} strokeLinecap="round" />
              {pts.map(([px, py], i) => (
                <circle key={i} cx={px} cy={py} r="3.5" fill="#fff" stroke={s.color} strokeWidth="2">
                  <title>{`${labels[i]}: ${format(s.values[i])}`}</title>
                </circle>
              ))}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
