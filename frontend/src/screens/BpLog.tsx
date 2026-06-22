// BpLog.tsx — blood-pressure log with steppers, neutral trend chart, readings list.
// CLINICAL NEUTRALITY: no red/green, no thresholds, no "normal" bands.
// Status (within/above/below target) shown only when a doctor target exists, in neutral text.
import { useEffect, useState, useCallback } from "react";
import { api } from "../api/client";
import { usePersonPicker } from "../lib/personPicker";
import { Button } from "../components/Button";
import { Confirmation } from "../components/Confirmation";
import { BpChart } from "../components/BpChart";

interface Reading {
  id: number;
  systolic: number;
  diastolic: number;
  pulse: number | null;
  taken_at: string;
  note: string | null;
  status: { systolic: string; diastolic: string } | null;
}

interface Target {
  sys_low: number;
  sys_high: number;
  dia_low: number;
  dia_high: number;
  doctor_label: string;
}

// Hoisted helper — big stepper control (≥60px buttons per brief)
function Stepper({
  label,
  value,
  set,
}: {
  label: string;
  value: number;
  set: (n: number) => void;
}) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-base font-bold">{label}</span>
      <div className="flex items-center gap-2">
        <button
          onClick={() => set(value - 1)}
          className="w-16 h-16 border-4 rounded-xl text-big font-bold"
          aria-label={`${label} decrease`}
        >
          −
        </button>
        <span className="text-huge w-20 text-center" aria-live="polite">
          {value}
        </span>
        <button
          onClick={() => set(value + 1)}
          className="w-16 h-16 border-4 rounded-xl text-big font-bold"
          aria-label={`${label} increase`}
        >
          ＋
        </button>
      </div>
    </div>
  );
}

// Hoisted helper — single reading row, shows factual status only when target exists
function ReadingRow({ r }: { r: Reading }) {
  return (
    <li className="border-4 rounded-xl p-3 text-big flex flex-wrap gap-3 items-center">
      <span className="font-bold">
        {r.systolic}/{r.diastolic}
      </span>
      {r.pulse != null && (
        <span className="text-base">♥ {r.pulse}</span>
      )}
      <span className="text-base">{r.taken_at.slice(0, 10)}</span>
      {/* Status shown ONLY when a doctor target is set — factual words, NO red/green */}
      {r.status != null && (
        <span className="text-base italic">
          systolic {r.status.systolic} target · diastolic {r.status.diastolic} target
        </span>
      )}
    </li>
  );
}

const RANGE_OPTIONS: [number, string][] = [
  [30, "30 days"],
  [90, "90 days"],
  [0, "All"],
];

export function BpLog() {
  const { selected, picker } = usePersonPicker();
  const [readings, setReadings] = useState<Reading[]>([]);
  const [target, setTarget] = useState<Target | null>(null);
  const [days, setDays] = useState(30);
  const [showPulse, setShowPulse] = useState(false);
  const [sys, setSys] = useState(120);
  const [dia, setDia] = useState(80);
  const [pulse, setPulse] = useState(70);
  const [ack, setAck] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (selected == null) return;
    const v = await api
      .get<{ readings: Reading[]; target: Target | null }>(
        `/api/people/${selected}/bp?days=${days}`
      )
      .catch(() => null);
    if (v != null) {
      setReadings(v.readings);
      setTarget(v.target);
    }
  }, [selected, days]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleLog() {
    if (selected == null) return;
    await api
      .post(`/api/people/${selected}/bp`, {
        systolic: sys,
        diastolic: dia,
        pulse,
      })
      .catch(() => null);
    setAck("Reading saved");
    void load();
  }

  return (
    <div className="p-6 flex flex-col gap-6">
      {ack != null && (
        <Confirmation message={ack} onDone={() => setAck(null)} />
      )}

      <h2 className="text-huge font-bold">Blood pressure</h2>

      {picker}

      {/* Entry form — big steppers ≥60px */}
      <div className="flex gap-6 flex-wrap items-end">
        <Stepper label="Top (systolic)" value={sys} set={setSys} />
        <Stepper label="Bottom (diastolic)" value={dia} set={setDia} />
        <Stepper label="Pulse" value={pulse} set={setPulse} />
        <Button
          onClick={() => void handleLog()}
          icon={<span aria-hidden="true">＋</span>}
        >
          Save reading
        </Button>
      </div>

      {/* Time-range control + pulse toggle — bg-brand for active, never bg-dad */}
      <div className="flex gap-touch items-center flex-wrap">
        {RANGE_OPTIONS.map(([d, label]) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={`min-h-touch px-4 rounded-xl text-base font-bold ${
              days === d ? "bg-brand text-paper" : "border-4"
            }`}
          >
            {label}
          </button>
        ))}
        <label className="text-base flex items-center gap-2 ml-4">
          <input
            type="checkbox"
            className="w-6 h-6"
            checked={showPulse}
            onChange={e => setShowPulse(e.target.checked)}
          />
          Show pulse
        </label>
      </div>

      {/* Trend chart — two series by line-style + legend, not color */}
      <BpChart readings={readings} target={target} showPulse={showPulse} />

      {/* Recent readings list */}
      <section>
        <h3 className="text-big font-bold mb-2">Recent readings</h3>
        <ul className="flex flex-col gap-2">
          {readings.map(r => (
            <ReadingRow key={r.id} r={r} />
          ))}
        </ul>
      </section>
    </div>
  );
}
