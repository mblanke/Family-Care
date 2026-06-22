// BpChart.tsx — hand-rolled SVG trend chart for blood pressure
// Series are distinguished by LINE STYLE (solid/dashed) and plain-language legend.
// No color-coded thresholds, no good/bad bands, no clinical ranges.
// If a doctor target exists, faint labeled reference lines only.

interface Reading {
  taken_at: string;
  systolic: number;
  diastolic: number;
  pulse: number | null;
}

interface Target {
  sys_low: number;
  sys_high: number;
  dia_low: number;
  dia_high: number;
  doctor_label: string;
}

export function BpChart({
  readings,
  target,
  showPulse,
}: {
  readings: Reading[];
  target: Target | null;
  showPulse: boolean;
}) {
  const W = 700, H = 320, P = 40;
  // oldest → newest, left → right
  const data = [...readings].reverse();

  if (data.length === 0) {
    return <p className="text-big">No readings yet.</p>;
  }

  const valuesInView = data.flatMap(d => [
    d.systolic,
    d.diastolic,
    ...(showPulse && d.pulse != null ? [d.pulse] : []),
  ]);

  const lo = Math.min(
    ...valuesInView,
    target != null ? target.dia_low : Infinity
  ) - 10;

  const hi = Math.max(
    ...valuesInView,
    target != null ? target.sys_high : -Infinity
  ) + 10;

  const xPos = (i: number) =>
    P + (i * (W - 2 * P)) / Math.max(1, data.length - 1);

  const yPos = (v: number) =>
    H - P - ((v - lo) * (H - 2 * P)) / (hi - lo);

  const buildPath = (key: "systolic" | "diastolic" | "pulse") =>
    data
      .map((d, i) => {
        const val = d[key] as number | null;
        if (val == null) return null;
        return `${i === 0 ? "M" : "L"}${xPos(i)},${yPos(val)}`;
      })
      .filter(Boolean)
      .join(" ");

  return (
    <div className="flex flex-col gap-2">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full border-4 rounded-2xl"
        role="img"
        aria-label="Blood pressure over time"
      >
        {/* Doctor target reference lines — only if a target is set, clearly labeled */}
        {target != null && (
          <>
            <line
              x1={P} x2={W - P}
              y1={yPos(target.sys_high)} y2={yPos(target.sys_high)}
              stroke="currentColor" strokeOpacity="0.25" strokeDasharray="2 6"
            />
            <line
              x1={P} x2={W - P}
              y1={yPos(target.dia_low)} y2={yPos(target.dia_low)}
              stroke="currentColor" strokeOpacity="0.25" strokeDasharray="2 6"
            />
            <text
              x={W - P} y={yPos(target.sys_high) - 4}
              textAnchor="end" fontSize="14" opacity="0.6"
            >
              {target.doctor_label}&apos;s target
            </text>
          </>
        )}

        {/* Systolic — solid line */}
        <path
          d={buildPath("systolic")}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
        />

        {/* Diastolic — dashed line (distinguished by style, not color) */}
        <path
          d={buildPath("diastolic")}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeDasharray="8 6"
        />

        {/* Pulse — optional dotted line, off by default */}
        {showPulse && (
          <path
            d={buildPath("pulse")}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeDasharray="1 5"
          />
        )}
      </svg>

      {/* Plain-language legend — not color-only */}
      <ul className="text-base flex flex-col gap-1">
        <li>━━ Systolic — top number</li>
        <li>╌╌ Diastolic — bottom number</li>
        {showPulse && <li>···· Pulse</li>}
      </ul>
    </div>
  );
}
