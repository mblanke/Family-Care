import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../lib/auth";
import { usePersonPicker } from "../lib/personPicker";
import { formatDate } from "../lib/format";
import { Button } from "../components/Button";
import { Card, Well } from "../components/Card";
import { Confirmation } from "../components/Confirmation";
import { ErrorBanner } from "../components/ErrorBanner";
import { PromptDialog } from "../components/PromptDialog";
import { ScreenTitle } from "../components/ScreenTitle";
import { Icon, type IconName } from "../components/icons";
import { ScanReview } from "../admin/ScanReview";

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

const SLOTS: [string, string, IconName][] = [
  ["morning", "Morning", "sun"],
  ["noon", "Noon", "clock"],
  ["evening", "Evening", "moon"],
  ["bedtime", "Bedtime", "bed"],
];

const EMPTY_FORM = { name: "", dose: "", slot: "morning", purpose: "", prescriber: "", reason: "" };

type Dialog =
  | { kind: "dose"; med: Med }
  | { kind: "stop"; med: Med }
  | { kind: "note" }
  | null;

function MedCard({
  med, isAdmin, onChangeDose, onStop,
}: {
  med: Med; isAdmin: boolean; onChangeDose: (m: Med) => void; onStop: (m: Med) => void;
}) {
  const details = [
    med.purpose ? `For ${med.purpose}` : null,
    med.prescriber ? `Prescribed by ${med.prescriber}` : null,
  ].filter(Boolean).join(" · ");
  return (
    <Well className="flex-col !items-start gap-2">
      <p className="m-0 flex items-baseline gap-3 flex-wrap">
        <span className="text-big font-bold">{med.name}</span>
        <span className="chrome rounded-[12px] px-3 py-1 font-display text-base font-bold">{med.dose}</span>
        {med.prn && <span className="text-base text-ink-soft">as needed</span>}
      </p>
      {details && <p className="m-0 text-base text-ink-soft">{details}</p>}
      {isAdmin && (
        <div className="flex gap-touch mt-1 flex-wrap">
          <Button variant="secondary" size="base" onClick={() => onChangeDose(med)}>Change dose</Button>
          <Button variant="secondary" size="base" onClick={() => onStop(med)}>Stop medication</Button>
        </div>
      )}
    </Well>
  );
}

function HistoryItem({ entry }: { entry: Change }) {
  return (
    <li className="border-l-4 border-brand/60 pl-4 text-base py-1">
      <span className="font-bold">{formatDate(entry.recorded_at)}</span> — {entry.summary}
      {entry.reason ? <span className="italic text-ink-soft"> ({entry.reason})</span> : ""}
    </li>
  );
}

export function Medications() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const { selected, people, picker } = usePersonPicker();
  const personName = people.find(p => p.id === selected)?.name;
  const [regimen, setRegimen] = useState<Med[]>([]);
  const [history, setHistory] = useState<Change[]>([]);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [ack, setAck] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  function load(pid: number) {
    api
      .get<{ regimen: Med[]; history: Change[] }>(`/api/people/${pid}/medications`)
      .then(r => { setRegimen(r.regimen); setHistory(r.history); })
      .catch(() => setError("Couldn't load the medication record. Please try again."));
  }

  useEffect(() => {
    if (selected != null) load(selected);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  async function addMed() {
    if (selected == null) return;
    if (!form.name.trim() || !form.dose.trim()) {
      setFormError("Enter the medication name and dose.");
      return;
    }
    try {
      await api.post(`/api/people/${selected}/medications`, {
        name: form.name.trim(),
        dose: form.dose.trim(),
        slot: form.slot,
        purpose: form.purpose || null,
        prescriber: form.prescriber || null,
        reason: form.reason || null,
      });
      setForm(EMPTY_FORM);
      setAdding(false);
      setFormError(null);
      setAck("Medication added");
      load(selected);
    } catch {
      setError("Couldn't save the medication. Please try again.");
    }
  }

  async function saveDose(m: Med, values: Record<string, string>) {
    setDialog(null);
    try {
      await api.post(`/api/medications/${m.id}/dose`, { new_dose: values.dose, reason: values.reason || null });
      setAck("Dose change recorded");
      if (selected != null) load(selected);
    } catch {
      setError("Couldn't save the dose change. Please try again.");
    }
  }

  async function stopMed(m: Med, values: Record<string, string>) {
    setDialog(null);
    try {
      await api.post(`/api/medications/${m.id}/stop`, { reason: values.reason || null });
      setAck(`${m.name} marked as stopped`);
      if (selected != null) load(selected);
    } catch {
      setError("Couldn't stop the medication. Please try again.");
    }
  }

  async function addNote(values: Record<string, string>) {
    setDialog(null);
    if (selected == null) return;
    try {
      await api.post(`/api/people/${selected}/medications/note`, { summary: values.summary });
      setAck("Note added");
      load(selected);
    } catch {
      setError("Couldn't save the note. Please try again.");
    }
  }

  const active = regimen.filter(m => m.active);
  const fieldCls = "field rounded-[20px] px-5 text-big";

  return (
    <div className="flex flex-col gap-6">
      {ack && <Confirmation message={ack} onDone={() => setAck(null)} />}
      {error && <ErrorBanner message={error} onDone={() => setError(null)} />}

      <ScreenTitle right={picker}>Medications</ScreenTitle>
      <p className="m-0 text-base text-ink-soft px-1">
        A personal record to share with your doctor or pharmacist. Not medical advice.
      </p>

      {active.length === 0 && (
        <Card>
          <p className="m-0 text-big text-ink-soft">
            No medications recorded{personName ? ` for ${personName}` : ""}.
          </p>
        </Card>
      )}

      {SLOTS.map(([key, label, icon]) => {
        const meds = active.filter(m => m.slot === key);
        if (meds.length === 0) return null;
        return (
          <Card key={key} title={label} icon={icon}>
            {meds.map(m => (
              <MedCard key={m.id} med={m} isAdmin={isAdmin}
                       onChangeDose={med => setDialog({ kind: "dose", med })}
                       onStop={med => setDialog({ kind: "stop", med })} />
            ))}
          </Card>
        );
      })}

      {isAdmin && selected != null && (
        <ScanReview personId={selected} onAdded={() => load(selected)} />
      )}

      {isAdmin && (
        adding ? (
          <Card title="Add a medication" icon="pill">
            {formError && (
              <p role="alert" className="m-0 text-big font-bold text-danger flex items-center gap-3">
                <Icon name="alert" size={30} />{formError}
              </p>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-base font-bold">Name
                <input className={fieldCls} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
              <label className="flex flex-col gap-1 text-base font-bold">Dose, as written on the label
                <input className={fieldCls} placeholder="For example: 5 mg" value={form.dose} onChange={e => setForm({ ...form, dose: e.target.value })} /></label>
              <label className="flex flex-col gap-1 text-base font-bold">When it's taken
                <select className={fieldCls} value={form.slot} onChange={e => setForm({ ...form, slot: e.target.value })}>
                  {SLOTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select></label>
              <label className="flex flex-col gap-1 text-base font-bold"><span>What it's for <span className="font-normal text-ink-soft">(optional)</span></span>
                <input className={fieldCls} value={form.purpose} onChange={e => setForm({ ...form, purpose: e.target.value })} /></label>
              <label className="flex flex-col gap-1 text-base font-bold"><span>Prescriber <span className="font-normal text-ink-soft">(optional)</span></span>
                <input className={fieldCls} value={form.prescriber} onChange={e => setForm({ ...form, prescriber: e.target.value })} /></label>
              <label className="flex flex-col gap-1 text-base font-bold"><span>Why it was added <span className="font-normal text-ink-soft">(optional)</span></span>
                <input className={fieldCls} value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} /></label>
            </div>
            <div className="flex gap-touch flex-wrap">
              <Button onClick={addMed} icon={<Icon name="check" strokeWidth={3} />}>Save medication</Button>
              <Button variant="secondary" onClick={() => { setAdding(false); setFormError(null); }}>Cancel</Button>
            </div>
          </Card>
        ) : (
          <div className="flex gap-touch flex-wrap">
            <Button onClick={() => setAdding(true)} icon={<Icon name="plus" strokeWidth={2.8} />}>Add medication</Button>
            <Button variant="secondary" onClick={() => setDialog({ kind: "note" })} icon={<Icon name="note" />}>Add a note</Button>
          </div>
        )
      )}

      <Card title="Change history" icon="clock">
        {history.length === 0 ? (
          <p className="m-0 text-base text-ink-soft">No changes recorded yet.</p>
        ) : (
          <ul className="m-0 p-0 list-none flex flex-col gap-2">
            {history.map(h => <HistoryItem key={h.id} entry={h} />)}
          </ul>
        )}
      </Card>

      <PromptDialog
        open={dialog?.kind === "dose"}
        title={dialog?.kind === "dose" ? `New dose for ${dialog.med.name}` : ""}
        helper={dialog?.kind === "dose"
          ? `Current dose: ${dialog.med.dose}. Type the new dose exactly as written on the label. The app records it as typed and does not check it.`
          : undefined}
        fields={[
          { key: "dose", label: "New dose" },
          { key: "reason", label: "Reason", placeholder: "For example: Dr. Lee reduced it", optional: true },
        ]}
        confirmLabel="Save dose"
        onConfirm={v => dialog?.kind === "dose" && saveDose(dialog.med, v)}
        onCancel={() => setDialog(null)}
      />
      <PromptDialog
        open={dialog?.kind === "stop"}
        title={dialog?.kind === "stop" ? `Stop ${dialog.med.name}?` : ""}
        helper="This marks the medication as stopped in the record. Nothing is deleted; it stays in the change history."
        fields={[{ key: "reason", label: "Reason", placeholder: "For example: Dr. Lee stopped it", optional: true }]}
        confirmLabel="Mark as stopped"
        onConfirm={v => dialog?.kind === "stop" && stopMed(dialog.med, v)}
        onCancel={() => setDialog(null)}
      />
      <PromptDialog
        open={dialog?.kind === "note"}
        title="Add a note to the history"
        helper="Recorded exactly as typed, with today's date."
        fields={[{ key: "summary", label: "Note" }]}
        confirmLabel="Save note"
        onConfirm={addNote}
        onCancel={() => setDialog(null)}
      />
    </div>
  );
}
