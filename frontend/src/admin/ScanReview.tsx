import { useState } from "react";
import { api } from "../api/client";
import { Button } from "../components/Button";
import { Confirmation } from "../components/Confirmation";

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

  return (
    <div className="border-4 rounded-2xl p-4 flex flex-col gap-3">
      {ack && <Confirmation message={ack} onDone={() => setAck(null)} />}
      <label
        className="min-h-touch px-6 rounded-2xl bg-brand text-paper text-big font-bold
                   inline-flex items-center gap-3 cursor-pointer w-fit"
      >
        📷 Scan label
        <input
          aria-label="Scan label"
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={onFile}
        />
      </label>
      {busy && <p className="text-big">Reading the label…</p>}
      {err && (
        <p className="text-big text-red-700" role="alert">
          {err} — you can still type it in manually.
        </p>
      )}
      {rows.length > 0 && (
        <p className="text-base italic">
          Check each line against the label before adding — the scan can
          misread; nothing is saved until you press Add.
        </p>
      )}
      {rows.map((r, i) => (
        <div key={i} className="border-2 rounded-xl p-3 flex flex-col gap-2">
          <input
            aria-label="Medication name"
            className="text-big p-2 border-4 rounded-xl"
            value={r.name}
            onChange={(e) => edit(i, { name: e.target.value })}
          />
          <input
            aria-label="Dose"
            className="text-big p-2 border-4 rounded-xl"
            value={r.dose}
            onChange={(e) => edit(i, { dose: e.target.value })}
          />
          <select
            aria-label="Slot"
            className="text-big p-2 border-4 rounded-xl"
            value={r.slot}
            onChange={(e) => edit(i, { slot: e.target.value })}
          >
            {SLOTS.map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
          <input
            aria-label="Prescriber"
            className="text-big p-2 border-4 rounded-xl"
            placeholder="Prescriber"
            value={r.prescriber ?? ""}
            onChange={(e) => edit(i, { prescriber: e.target.value })}
          />
          <Button onClick={() => addRow(i)} icon={<span aria-hidden>＋</span>}>
            Add to regimen
          </Button>
        </div>
      ))}
      {rows.length > 0 && (
        <label className="text-base flex items-center gap-3">
          <input
            type="checkbox"
            className="w-7 h-7"
            checked={keepPhoto}
            onChange={(e) => setKeepPhoto(e.target.checked)}
          />
          Keep photo with these entries
        </label>
      )}
    </div>
  );
}
