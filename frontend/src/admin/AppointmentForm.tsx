// AppointmentForm.tsx — create/edit an appointment (admin + family)
import { useState } from "react";
import { api } from "../api/client";
import type { PersonApi } from "../api/types";
import { PersonBadge } from "../components/PersonBadge";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { ErrorBanner } from "../components/ErrorBanner";
import { Icon } from "../components/icons";

interface Props {
  people: PersonApi[];
  apptId?: number;              // present when editing
  initial?: Partial<FormState>;
  onSaved: () => void;
  onCancel: () => void;
}

interface FormState {
  title: string;
  date: string;        // YYYY-MM-DD
  startTime: string;   // HH:MM
  endTime: string;     // HH:MM or ""
  location: string;
  personMode: "both" | number;  // "both" = for_both, number = person_id
  needsRide: boolean;
  monthly: boolean;
  notes: string;
}

// Hoisted helpers — NOT inside AppointmentForm render body
function Toggle({ label, icon, checked, onChange }:
  { label: string; icon: "car" | "repeat"; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-4 min-h-touch cursor-pointer">
      <input type="checkbox" className="w-9 h-9 accent-brand" checked={checked} onChange={e => onChange(e.target.checked)} />
      <Icon name={icon} size={28} />
      <span className="text-big">{label}</span>
    </label>
  );
}

function buildBody(f: FormState): {
  title: string;
  start: string;
  end: string | null;
  location: string | null;
  person_id: number | null;
  for_both: boolean;
  needs_ride: boolean;
  notes: string | null;
  recurrence: "none" | "monthly";
  recur_day: number | null;
} {
  const start = `${f.date}T${f.startTime}:00`;
  const end = f.endTime ? `${f.date}T${f.endTime}:00` : null;
  const forBoth = f.personMode === "both";
  const personId = forBoth ? null : (typeof f.personMode === "number" ? f.personMode : null);
  return {
    title: f.title,
    start,
    end,
    location: f.location || null,
    person_id: personId,
    for_both: forBoth,
    needs_ride: f.needsRide,
    notes: f.notes || null,
    recurrence: f.monthly ? "monthly" : "none",
    recur_day: f.monthly ? parseInt(f.date.slice(8, 10), 10) : null,
  };
}

const EMPTY: FormState = {
  title: "", date: "", startTime: "", endTime: "",
  location: "", personMode: "both", needsRide: false, monthly: false, notes: "",
};

export function AppointmentForm({ people, apptId, initial, onSaved, onCancel }: Props) {
  const [f, setF] = useState<FormState>({ ...EMPTY, ...initial });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  function set<K extends keyof FormState>(k: K, v: FormState[K]): void {
    setF(prev => ({ ...prev, [k]: v }));
  }

  async function save(): Promise<void> {
    if (!f.title.trim() || !f.date || !f.startTime) {
      setFormError("Enter a title, a date and a start time.");
      return;
    }
    setFormError(null);
    setSaving(true);
    try {
      const body = buildBody(f);
      if (apptId) {
        await api.put(`/api/appointments/${apptId}`, body);
      } else {
        await api.post("/api/appointments", body);
      }
      onSaved();
    } catch {
      setError("Couldn't save the appointment. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const fieldCls = "field rounded-[20px] px-5 text-big";

  return (
    <Card title={apptId ? "Edit appointment" : "New appointment"} icon="calendar">
      {error && <ErrorBanner message={error} onDone={() => setError(null)} />}
      {formError && (
        <p role="alert" className="m-0 text-big font-bold text-danger flex items-center gap-3">
          <Icon name="alert" size={30} />{formError}
        </p>
      )}

      <label className="flex flex-col gap-1 text-base font-bold">Title
        <input className={fieldCls} value={f.title} onChange={e => set("title", e.target.value)} aria-label="Title" /></label>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-base font-bold">Date
          <input type="date" className={fieldCls} value={f.date} onChange={e => set("date", e.target.value)} aria-label="Date" /></label>
        <label className="flex flex-col gap-1 text-base font-bold">Starts
          <input type="time" className={fieldCls} value={f.startTime} onChange={e => set("startTime", e.target.value)} aria-label="Start time" /></label>
        <label className="flex flex-col gap-1 text-base font-bold"><span>Ends <span className="font-normal text-ink-soft">(optional)</span></span>
          <input type="time" className={fieldCls} value={f.endTime} onChange={e => set("endTime", e.target.value)} aria-label="End time" /></label>
      </div>

      <label className="flex flex-col gap-1 text-base font-bold"><span>Location <span className="font-normal text-ink-soft">(optional)</span></span>
        <input className={fieldCls} value={f.location} onChange={e => set("location", e.target.value)} aria-label="Location" /></label>

      {/* Person chips — PersonBadge uses person colors (correct usage) */}
      <div className="flex flex-col gap-2">
        <span className="text-base font-bold">Who it's for</span>
        <div className="flex gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => set("personMode", "both")}
            className={`min-h-touch px-6 text-base font-bold rounded-pill pressable ${f.personMode === "both" ? "btn-primary" : "chrome"}`}
            aria-pressed={f.personMode === "both"}
          >
            Everyone
          </button>
          {people.map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => set("personMode", p.id)}
              aria-pressed={f.personMode === p.id}
              className={`min-h-touch px-3 rounded-pill pressable inline-flex items-center
                ${f.personMode === p.id ? "chrome ring-4 ring-brand" : "chrome opacity-70"}`}
            >
              <PersonBadge person={p} />
            </button>
          ))}
        </div>
      </div>

      <Toggle label="Needs a ride" icon="car" checked={f.needsRide} onChange={v => set("needsRide", v)} />
      <Toggle label="Repeats monthly" icon="repeat" checked={f.monthly} onChange={v => set("monthly", v)} />

      <div className="flex gap-touch flex-wrap">
        <Button onClick={save} disabled={saving} icon={<Icon name="check" strokeWidth={3} />}>
          {saving ? "Saving…" : apptId ? "Update appointment" : "Save appointment"}
        </Button>
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
      </div>
    </Card>
  );
}
