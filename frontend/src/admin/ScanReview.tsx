import { useState } from "react";
import { api } from "../api/client";
import { Button } from "../components/Button";
import { Card, Well } from "../components/Card";
import { Confirmation } from "../components/Confirmation";
import { Icon } from "../components/icons";

interface Cand {
  name: string;
  dose: string;
  slot: string;
  prescriber: string | null;
}

const SLOTS: [string, string][] = [
  ["morning", "Morning"],
  ["noon", "Noon"],
  ["evening", "Evening"],
  ["bedtime", "Bedtime"],
];

// Server messages that carry no information for the reader
const GENERIC = /^(scan failed|internal server error|bad gateway|service unavailable|failed to fetch|)$/i;

export function ScanReview({
  personId,
  onAdded,
}: {
  personId: number;
  onAdded: () => void;
}) {
  const [scanId, setScanId] = useState<string | null>(null);
  const [rows, setRows] = useState<Cand[]>([]);
  const [keepPhoto, setKeepPhoto] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ack, setAck] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setErr(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/people/${personId}/medications/scan`, {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      if (!res.ok) {
        throw new Error(
          (await res.json().catch(() => ({}))).detail ?? "Scan failed"
        );
      }
      const data = await res.json();
      setScanId(data.scan_id);
      setRows(data.candidates);
    } catch (x) {
      setErr((x as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function edit(i: number, patch: Partial<Cand>) {
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }

  async function addRow(i: number) {
    const r = rows[i];
    try {
      await api.post(`/api/people/${personId}/medications`, {
        name: r.name,
        dose: r.dose,
        slot: r.slot,
        prescriber: r.prescriber || null,
        scan_id: scanId,
        keep_photo: keepPhoto,
      });
      setAck(`Added ${r.name}`);
      setRows((rs) => rs.filter((_, j) => j !== i));
      onAdded();
    } catch (x) {
      setErr((x as Error).message);
    }
  }

  const fieldCls = "field rounded-[18px] px-4 text-big";

  return (
    <Card title="Scan a pharmacy label" icon="camera">
      {ack && <Confirmation message={ack} onDone={() => setAck(null)} />}
      <div className="flex items-center gap-4 flex-wrap">
        <label className="btn-primary pressable min-h-touch px-7 rounded-pill text-big font-bold inline-flex items-center gap-3 cursor-pointer w-fit">
          <Icon name="camera" />
          Scan a label
          <input
            aria-label="Scan label"
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only-label"
            onChange={onFile}
          />
        </label>
        <span className="text-base text-ink-soft">Photographs the label and fills in the fields for you to check.</span>
      </div>
      {busy && <p className="m-0 text-big">Reading the label…</p>}
      {err && (
        <p className="m-0 text-big font-bold text-danger flex items-start gap-3" role="alert">
          <Icon name="alert" size={30} className="shrink-0 mt-1" />
          <span>
            Couldn't read the label. You can still type it in below.
            {!GENERIC.test(err.trim()) && <span className="block text-base font-normal text-ink-soft">{err}</span>}
          </span>
        </p>
      )}
      {rows.length > 0 && (
        <p className="m-0 text-base text-ink-soft">
          Check each line against the label before adding. The scan can
          misread; nothing is saved until you press Add.
        </p>
      )}
      {rows.map((r, i) => (
        <Well key={i} className="flex-col !items-stretch gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-base font-bold">Medication name
              <input aria-label="Medication name" className={fieldCls} value={r.name} onChange={(e) => edit(i, { name: e.target.value })} /></label>
            <label className="flex flex-col gap-1 text-base font-bold">Dose
              <input aria-label="Dose" className={fieldCls} value={r.dose} onChange={(e) => edit(i, { dose: e.target.value })} /></label>
            <label className="flex flex-col gap-1 text-base font-bold">When it's taken
              <select aria-label="Slot" className={fieldCls} value={r.slot} onChange={(e) => edit(i, { slot: e.target.value })}>
                {SLOTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select></label>
            <label className="flex flex-col gap-1 text-base font-bold">Prescriber
              <input aria-label="Prescriber" className={fieldCls} value={r.prescriber ?? ""} onChange={(e) => edit(i, { prescriber: e.target.value })} /></label>
          </div>
          <div>
            <Button onClick={() => addRow(i)} icon={<Icon name="plus" strokeWidth={2.8} />}>Add this medication</Button>
          </div>
        </Well>
      ))}
      {rows.length > 0 && (
        <label className="text-base font-bold flex items-center gap-3 min-h-touch">
          <input type="checkbox" className="w-8 h-8 accent-brand" checked={keepPhoto} onChange={(e) => setKeepPhoto(e.target.checked)} />
          Keep the photo with this medication
        </label>
      )}
    </Card>
  );
}
