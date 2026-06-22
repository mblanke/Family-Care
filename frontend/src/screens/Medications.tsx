import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../lib/auth";
import { usePersonPicker } from "../lib/personPicker";
import { Button } from "../components/Button";

interface Med {
  id: number;
  name: string;
  dose: string;
  slot: string;
  purpose: string | null;
  prescriber: string | null;
  prn: boolean;
  active: boolean;
  pack_pickup: string | null;
}

interface Change {
  id: number;
  change_type: string;
  summary: string;
  reason: string | null;
  recorded_at: string;
  medication_id: number | null;
}

const SLOTS: [string, string][] = [
  ["morning", "Morning"],
  ["noon", "Noon"],
  ["evening", "Evening"],
  ["bedtime", "Bedtime"],
];

const EMPTY_FORM = { name: "", dose: "", slot: "morning", purpose: "", prescriber: "", reason: "" };

function MedCard({
  med,
  isAdmin,
  onChangeDose,
  onStop,
}: {
  med: Med;
  isAdmin: boolean;
  onChangeDose: (m: Med) => void;
  onStop: (m: Med) => void;
}) {
  return (
    <div className="border-4 rounded-2xl p-4 mb-2">
      <p className="text-big font-semibold">
        <span>{med.name}</span>{" — "}<span>{med.dose}</span>{med.prn ? " (as needed)" : ""}
      </p>
      {med.purpose && <p className="text-base">For: {med.purpose}</p>}
      {med.prescriber && <p className="text-base">Prescriber: {med.prescriber}</p>}
      {isAdmin && (
        <div className="flex gap-touch mt-2">
          <button
            onClick={() => onChangeDose(med)}
            className="min-h-touch px-4 border-4 rounded-xl text-base"
          >
            Change dose
          </button>
          <button
            onClick={() => onStop(med)}
            className="min-h-touch px-4 border-4 rounded-xl text-base"
          >
            Stop
          </button>
        </div>
      )}
    </div>
  );
}

function HistoryItem({ entry }: { entry: Change }) {
  return (
    <li className="border-l-4 pl-3 text-base">
      <span className="font-semibold">{entry.recorded_at.slice(0, 10)}</span> — {entry.summary}
      {entry.reason ? <span className="italic"> ({entry.reason})</span> : ""}
    </li>
  );
}

export function Medications() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const { selected, picker } = usePersonPicker();
  const [regimen, setRegimen] = useState<Med[]>([]);
  const [history, setHistory] = useState<Change[]>([]);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  function load(pid: number) {
    api
      .get<{ regimen: Med[]; history: Change[] }>(`/api/people/${pid}/medications`)
      .then(r => { setRegimen(r.regimen); setHistory(r.history); })
      .catch(() => { /* network failure: keep existing data */ });
  }

  useEffect(() => {
    if (selected != null) load(selected);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  async function addMed() {
    if (selected == null) return;
    await api
      .post(`/api/people/${selected}/medications`, {
        name: form.name,
        dose: form.dose,
        slot: form.slot,
        purpose: form.purpose || null,
        prescriber: form.prescriber || null,
        reason: form.reason || null,
      })
      .catch(() => { /* no-op */ });
    setForm(EMPTY_FORM);
    setAdding(false);
    if (selected != null) load(selected);
  }

  async function changeDose(m: Med) {
    const nd = prompt(
      `New dose for ${m.name} (current: ${m.dose}).\nThis value is recorded verbatim — the app does not check doses.`
    );
    if (!nd) return;
    const reason = prompt("Reason (optional, e.g. 'Dr. Lee reduced')") || null;
    await api
      .post(`/api/medications/${m.id}/dose`, { new_dose: nd, reason })
      .catch(() => { /* no-op */ });
    if (selected != null) load(selected);
  }

  async function stopMed(m: Med) {
    const reason = prompt(`Stop ${m.name}? Reason (optional)`) || null;
    await api
      .post(`/api/medications/${m.id}/stop`, { reason })
      .catch(() => { /* no-op */ });
    if (selected != null) load(selected);
  }

  return (
    <div className="p-6 flex flex-col gap-6">
      <h2 className="text-huge font-bold">Medications</h2>
      {picker}
      <p className="text-base italic">
        A personal record to share with your doctor or pharmacist — not medical advice.
      </p>

      {SLOTS.map(([key, label]) => {
        const meds = regimen.filter(m => m.slot === key && m.active);
        if (meds.length === 0) return null;
        return (
          <section key={key}>
            <h3 className="text-big font-bold mb-2">{label}</h3>
            {meds.map(m => (
              <MedCard
                key={m.id}
                med={m}
                isAdmin={isAdmin}
                onChangeDose={changeDose}
                onStop={stopMed}
              />
            ))}
          </section>
        );
      })}

      {isAdmin && (
        adding ? (
          <div className="border-4 rounded-2xl p-4 flex flex-col gap-2 max-w-xl">
            <input
              className="text-big p-2 border-4 rounded-xl"
              placeholder="Name"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
            />
            <input
              className="text-big p-2 border-4 rounded-xl"
              placeholder="Dose (e.g. 5 mg)"
              value={form.dose}
              onChange={e => setForm({ ...form, dose: e.target.value })}
            />
            <select
              className="text-big p-2 border-4 rounded-xl"
              value={form.slot}
              onChange={e => setForm({ ...form, slot: e.target.value })}
            >
              {SLOTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            <input
              className="text-big p-2 border-4 rounded-xl"
              placeholder="For (optional)"
              value={form.purpose}
              onChange={e => setForm({ ...form, purpose: e.target.value })}
            />
            <input
              className="text-big p-2 border-4 rounded-xl"
              placeholder="Prescriber (optional)"
              value={form.prescriber}
              onChange={e => setForm({ ...form, prescriber: e.target.value })}
            />
            <input
              className="text-big p-2 border-4 rounded-xl"
              placeholder="Reason for the record (optional)"
              value={form.reason}
              onChange={e => setForm({ ...form, reason: e.target.value })}
            />
            <Button onClick={addMed} icon={<span aria-hidden>＋</span>}>Save medication</Button>
          </div>
        ) : (
          <Button onClick={() => setAdding(true)} icon={<span aria-hidden>＋</span>}>
            Add medication
          </Button>
        )
      )}

      <section>
        <h3 className="text-big font-bold mb-2">Change history</h3>
        <ul className="flex flex-col gap-2">
          {history.map(h => <HistoryItem key={h.id} entry={h} />)}
        </ul>
      </section>
    </div>
  );
}
