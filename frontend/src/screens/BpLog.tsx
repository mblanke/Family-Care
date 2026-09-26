// BpLog.tsx — blood-pressure log with steppers, neutral trend chart, readings list.
// CLINICAL NEUTRALITY: no red/green, no thresholds, no "normal" bands.
// Status (within/above/below target) shown only when a doctor target exists, in neutral text.
import { useEffect, useState, useCallback } from "react";
import { api } from "../api/client";
import { usePersonPicker } from "../lib/personPicker";
import { useAuth } from "../lib/auth";
import { formatDateTime } from "../lib/format";
import { Button } from "../components/Button";
import { Card, Well } from "../components/Card";
import { Confirmation } from "../components/Confirmation";
import { ErrorBanner } from "../components/ErrorBanner";
import { BpChart } from "../components/BpChart";
import { ScreenTitle } from "../components/ScreenTitle";
import { SegmentedControl } from "../components/SegmentedControl";
import { Stepper } from "../components/Stepper";
import { Icon } from "../components/icons";

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

// Hoisted helper — single reading row, shows factual status only when target exists
function ReadingRow({ r }: { r: Reading }) {
  return (
    <Well className="flex-wrap">
      <span className="chrome rounded-[16px] min-w-[9rem] min-h-[60px] inline-flex items-center justify-center font-display text-big font-bold px-3">
        {r.systolic} / {r.diastolic}
      </span>
      {r.pulse != null && <span className="text-base text-ink-soft min-w-[5.5rem]">pulse {r.pulse}</span>}
      <span className="text-base flex-1 min-w-[13rem] whitespace-nowrap">{formatDateTime(r.taken_at)}</span>
      {/* Status shown ONLY when a doctor target is set — factual words, NO red/green */}
      {r.status != null && (
        <span className="text-base text-ink-soft">
          Top {r.status.systolic} range · Bottom {r.status.diastolic} range
        </span>
      )}
    </Well>
  );
}

const RANGE_OPTIONS = [
  { id: 30, label: "30 days" },
  { id: 90, label: "90 days" },
  { id: 0, label: "All" },
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
    } else {
      setError("Couldn't load the readings. Please try again.");
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
      setAck("Reading saved");
      setError(null);
      void load();
    } catch {
      setError("Couldn't save the reading. Please try again.");
    }
  }

  async function handleSaveTarget() {
    if (selected == null) return;
    if (tLabel.trim() === "") {
      setTargetError("Enter the doctor or clinic that set this target.");
      return;
    }
    const sysLow = Number(tSysLow);
    const sysHigh = Number(tSysHigh);
    const diaLow = Number(tDiaLow);
    const diaHigh = Number(tDiaHigh);
    if (!tSysLow || !tSysHigh || !tDiaLow || !tDiaHigh ||
        isNaN(sysLow) || isNaN(sysHigh) || isNaN(diaLow) || isNaN(diaHigh)) {
      setTargetError("Enter all four numbers.");
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
      setAck("Target saved");
      setTargetError(null);
      void load();
    } catch {
      setTargetError("Couldn't save the target. Please try again.");
    }
  }

  const numField = "field rounded-[18px] w-28 h-16 text-big text-center";

  return (
    <div className="flex flex-col gap-6">
      {ack != null && <Confirmation message={ack} onDone={() => setAck(null)} />}
      {error != null && <ErrorBanner message={error} onDone={() => setError(null)} />}

      <ScreenTitle right={picker}>Blood pressure</ScreenTitle>

      {/* Entry form — big steppers */}
      <Card title="New reading" icon="heart">
        <div className="flex gap-6 flex-wrap items-end justify-center">
          <Stepper label="Top (systolic)" value={sys} onChange={setSys} />
          <Stepper label="Bottom (diastolic)" value={dia} onChange={setDia} />
          <Stepper label="Pulse" value={pulse} onChange={setPulse} />
        </div>
        <Button variant="confirm" onClick={() => void handleLog()} disabled={selected == null}
                className="min-h-20 mt-2" icon={<Icon name="check" size={30} strokeWidth={3} />}>
          Save reading
        </Button>
      </Card>

      {/* Time-range control + pulse toggle + print link */}
      <div className="flex gap-touch items-center flex-wrap">
        <SegmentedControl label="Time range" size="base" options={RANGE_OPTIONS} value={days} onChange={setDays} className="w-auto" />
        <label className="text-base font-bold flex items-center gap-3 min-h-touch px-2">
          <input
            type="checkbox"
            className="w-8 h-8 accent-brand"
            checked={showPulse}
            onChange={e => setShowPulse(e.target.checked)}
          />
          Show pulse
        </label>
        {selected != null ? (
          <a
            href={`/api/people/${selected}/bp/export?days=${days}`}
            target="_blank"
            rel="noopener"
            className="chrome pressable rounded-pill min-h-touch px-5 text-base font-bold inline-flex items-center gap-2 no-underline text-ink ml-auto"
          >
            <Icon name="print" size={26} />Print or save as PDF
          </a>
        ) : null}
      </div>

      {/* Trend chart — two series by line-style + legend, not color */}
      <Card title={`Trend, ${days === 0 ? "all readings" : `last ${days} days`}`}>
        <BpChart readings={readings} target={target} showPulse={showPulse} />
      </Card>

      {/* Admin-only: doctor's target entry form */}
      {isAdmin && (
        <Card title="Doctor's target (optional)">
          <p className="m-0 text-base text-ink-soft">
            Enter the range your doctor gave. Each reading is then marked within, above or below
            that range. The app never decides what is normal.
          </p>
          {targetError != null && (
            <p role="alert" className="m-0 text-big font-bold text-danger flex items-center gap-3">
              <Icon name="alert" size={30} />{targetError}
            </p>
          )}
          <div className="flex flex-wrap gap-4 items-end">
            <label className="flex flex-col gap-1 text-base font-bold">
              Top, low end
              <input type="number" inputMode="numeric" className={numField} value={tSysLow} onChange={e => setTSysLow(e.target.value)} aria-label="Systolic low" />
            </label>
            <label className="flex flex-col gap-1 text-base font-bold">
              Top, high end
              <input type="number" inputMode="numeric" className={numField} value={tSysHigh} onChange={e => setTSysHigh(e.target.value)} aria-label="Systolic high" />
            </label>
            <label className="flex flex-col gap-1 text-base font-bold">
              Bottom, low end
              <input type="number" inputMode="numeric" className={numField} value={tDiaLow} onChange={e => setTDiaLow(e.target.value)} aria-label="Diastolic low" />
            </label>
            <label className="flex flex-col gap-1 text-base font-bold">
              Bottom, high end
              <input type="number" inputMode="numeric" className={numField} value={tDiaHigh} onChange={e => setTDiaHigh(e.target.value)} aria-label="Diastolic high" />
            </label>
            <label className="flex flex-col gap-1 text-base font-bold flex-1 min-w-[14rem]">
              Doctor or clinic
              <input type="text" className="field rounded-[18px] px-4 h-16 text-big" value={tLabel}
                     onChange={e => setTLabel(e.target.value)} placeholder="For example: Dr. Lee" aria-label="Doctor or clinic label" />
            </label>
          </div>
          <div>
            <Button onClick={() => void handleSaveTarget()} icon={<Icon name="check" strokeWidth={3} />}>Save target</Button>
          </div>
        </Card>
      )}

      {/* Recent readings list */}
      <Card title="Recent readings">
        {readings.length === 0 ? (
          <p className="m-0 text-base text-ink-soft">No readings in this range.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {readings.map(r => <ReadingRow key={r.id} r={r} />)}
          </div>
        )}
      </Card>

      <p className="m-0 text-base text-ink-soft text-center">
        A personal record to share with your doctor or pharmacist. Not medical advice.
      </p>
    </div>
  );
}
