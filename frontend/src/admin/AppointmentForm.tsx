// AppointmentForm.tsx — create/edit an appointment (admin + family)
import { useState } from "react";
import { api } from "../api/client";
import type { PersonApi } from "../api/types";
import { PersonBadge } from "../components/PersonBadge";
import { Button } from "../components/Button";

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
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-4 min-h-touch cursor-pointer">
      <input type="checkbox" className="w-8 h-8" checked={checked} onChange={e => onChange(e.target.checked)} />
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
    recur_day: f.monthly ? new Date(start).getDate() : null,
  };
}

const EMPTY: FormState = {
  title: "", date: "", startTime: "", endTime: "",
  location: "", personMode: "both", needsRide: false, monthly: false, notes: "",
};

export function AppointmentForm({ people, apptId, initial, onSaved, onCancel }: Props) {
  const [f, setF] = useState<FormState>({ ...EMPTY, ...initial });
  const [saving, setSaving] = useState(false);

  function set<K extends keyof FormState>(k: K, v: FormState[K]): void {
    setF(prev => ({ ...prev, [k]: v }));
  }

  async function save(): Promise<void> {
    if (!f.title.trim() || !f.date || !f.startTime) return;
    setSaving(true);
    try {
      const body = buildBody(f);
      if (apptId) {
        await api.put(`/api/appointments/${apptId}`, body);
      } else {
        await api.post("/api/appointments", body);
      }
      onSaved();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 border-4 rounded-2xl p-6">
      <h3 className="text-big font-bold">{apptId ? "Edit Appointment" : "New Appointment"}</h3>

      <input className="text-big p-4 border-4 rounded-xl" placeholder="Title"
        value={f.title} onChange={e => set("title", e.target.value)} aria-label="Title" />

      <input type="date" className="text-big p-4 border-4 rounded-xl"
        value={f.date} onChange={e => set("date", e.target.value)} aria-label="Date" />

      <div className="flex gap-3">
        <input type="time" className="text-big p-4 border-4 rounded-xl flex-1"
          value={f.startTime} onChange={e => set("startTime", e.target.value)} aria-label="Start time" />
        <input type="time" className="text-big p-4 border-4 rounded-xl flex-1"
          value={f.endTime} onChange={e => set("endTime", e.target.value)} aria-label="End time" />
      </div>

      <input className="text-big p-4 border-4 rounded-xl" placeholder="Location (optional)"
        value={f.location} onChange={e => set("location", e.target.value)} aria-label="Location" />

      {/* Person chips — PersonBadge uses person colors (correct usage) */}
      <div className="flex gap-3 flex-wrap">
        <button
          onClick={() => set("personMode", "both")}
          className={`min-h-touch px-5 text-base font-bold rounded-2xl border-4
            ${f.personMode === "both" ? "bg-brand text-paper border-brand" : ""}`}
          aria-pressed={f.personMode === "both"}
        >
          Both
        </button>
        {people.map(p => (
          <button
            key={p.id}
            onClick={() => set("personMode", p.id)}
            aria-pressed={f.personMode === p.id}
            className={`min-h-touch rounded-2xl border-4
              ${f.personMode === p.id ? "opacity-100 ring-4 ring-brand" : "opacity-60"}`}
          >
            <PersonBadge person={p} />
          </button>
        ))}
      </div>

      <Toggle label="🚗 Needs a ride" checked={f.needsRide} onChange={v => set("needsRide", v)} />
      <Toggle label="🔁 Repeat monthly" checked={f.monthly} onChange={v => set("monthly", v)} />

      <div className="flex gap-4">
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : apptId ? "Update" : "Save"}
        </Button>
        <button onClick={onCancel}
          className="min-h-touch px-5 text-big border-4 rounded-2xl">Cancel</button>
      </div>
    </div>
  );
}
