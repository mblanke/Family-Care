// BpLog.tsx — blood-pressure log with steppers, neutral trend chart, readings list.
// CLINICAL NEUTRALITY: no red/green, no thresholds, no "normal" bands.
// Status (within/above/below target) shown only when a doctor target exists, in neutral text.
import { useEffect, useState, useCallback } from "react";
import { api } from "../api/client";
import { usePersonPicker } from "../lib/personPicker";
import { useAuth } from "../lib/auth";
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
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const { selected, picker } = usePersonPicker();
  const [readings, setReadings] = useState<Reading[]>([]);
  const [target, setTarget] = useState<Target | null>(null);
  const [days, setDays] = useState(30);
  const [showPulse, setShowPulse] = useState(false);
  const [sys, setSys] = useState(120);
  const [dia, setDia] = useState(80);
  const [pulse, setPulse] = useState(70);
  const [ack, setAck] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Target form state (admin only)
  const [tSysLow, setTSysLow] = useState("");
  const [tSysHigh, setTSysHigh] = useState("");
  const [tDiaLow, setTDiaLow] = useState("");
  const [tDiaHigh, setTDiaHigh] = useState("");
  const [tLabel, setTLabel] = useState("");
  const [targetError, setTargetError] = useState<string | null>(null);

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
      // Pre-fill the admin target form with existing values
      if (v.target != null) {
        setTSysLow(String(v.target.sys_low));
        setTSysHigh(String(v.target.sys_high));
        setTDiaLow(String(v.target.dia_low));
        setTDiaHigh(String(v.target.dia_high));
        setTLabel(v.target.doctor_label);
      }
    }
  }, [selected, days]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleLog() {
    if (selected == null) return;
    try {
      await api.post(`/api/people/${selected}/bp`, {
        systolic: sys,
        diastolic: dia,
        pulse,
      });
      setAck("Reading saved ✓");
      setError(null);
      void load();
    } catch {
      setError("Could not save the reading — please try again.");
    }
  }

  async function handleSaveTarget() {
    if (selected == null) return;
    if (tLabel.trim() === "") {
      setTargetError("Doctor / clinic label is required.");
      return;
    }
    const sysLow = Number(tSysLow);
    const sysHigh = Number(tSysHigh);
    const diaLow = Number(tDiaLow);
    const diaHigh = Number(tDiaHigh);
    if (!tSysLow || !tSysHigh || !tDiaLow || !tDiaHigh ||
        isNaN(sysLow) || isNaN(sysHigh) || isNaN(diaLow) || isNaN(diaHigh)) {
      setTargetError("All four range values are required and must be numbers.");
      return;
    }
    try {
      await api.put(`/api/people/${selected}/bp/target`, {
        sys_low: sysLow,
        sys_high: sysHigh,
        dia_low: diaLow,
        dia_high: diaHigh,
        doctor_label: tLabel.trim(),
      });
      setAck("Target saved ✓");
      setTargetError(null);
      void load();
    } catch {
      setTargetError("Could not save the target — please try again.");
    }
  }

  return (
    <div className="p-6 flex flex-col gap-6">
      {ack != null && (
        <Confirmation message={ack} onDone={() => setAck(null)} />
      )}
      {error != null && (
        <p role="alert" className="text-big text-red-700">{error}</p>
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
        <a
          href={`/api/people/${selected}/bp/export?days=${days || 90}`}
          target="_blank"
          rel="noopener"
          className="min-h-touch px-4 rounded-xl border-4 text-base font-bold inline-flex items-center"
        >
          Print / Save PDF
        </a>
      </div>

      {/* Trend chart — two series by line-style + legend, not color */}
      <BpChart readings={readings} target={target} showPulse={showPulse} />

      {/* Admin-only: doctor's target entry form */}
      {isAdmin && (
        <section className="border-4 rounded-xl p-4 flex flex-col gap-4">
          <h3 className="text-big font-bold">Doctor's target (optional)</h3>
          <p className="text-base">
            Enter the range your doctor gave — readings are then shown as within
            / above / below it. Not the app deciding what's normal.
          </p>
          {targetError != null && (
            <p role="alert" className="text-big text-red-700">{targetError}</p>
          )}
          <div className="flex flex-wrap gap-4 items-end">
            <label className="flex flex-col gap-1 text-base">
              Systolic low
              <input
                type="number"
                className="border-4 rounded-xl w-24 h-16 text-big text-center"
                value={tSysLow}
                onChange={e => setTSysLow(e.target.value)}
                aria-label="Systolic low"
              />
            </label>
            <label className="flex flex-col gap-1 text-base">
              Systolic high
              <input
                type="number"
                className="border-4 rounded-xl w-24 h-16 text-big text-center"
                value={tSysHigh}
                onChange={e => setTSysHigh(e.target.value)}
                aria-label="Systolic high"
              />
            </label>
            <label className="flex flex-col gap-1 text-base">
              Diastolic low
              <input
                type="number"
                className="border-4 rounded-xl w-24 h-16 text-big text-center"
                value={tDiaLow}
                onChange={e => setTDiaLow(e.target.value)}
                aria-label="Diastolic low"
              />
            </label>
            <label className="flex flex-col gap-1 text-base">
              Diastolic high
              <input
                type="number"
                className="border-4 rounded-xl w-24 h-16 text-big text-center"
                value={tDiaHigh}
                onChange={e => setTDiaHigh(e.target.value)}
                aria-label="Diastolic high"
              />
            </label>
            <label className="flex flex-col gap-1 text-base">
              Doctor / clinic label
              <input
                type="text"
                className="border-4 rounded-xl px-3 h-16 text-big"
                value={tLabel}
                onChange={e => setTLabel(e.target.value)}
                placeholder="e.g. Dr. Lee"
                aria-label="Doctor or clinic label"
              />
            </label>
          </div>
          <div>
            <Button
              onClick={() => void handleSaveTarget()}
              icon={<span aria-hidden="true">✓</span>}
            >
              Save target
            </Button>
          </div>
        </section>
      )}

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
