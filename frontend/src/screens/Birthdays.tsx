// Birthdays.tsx — list + add/delete (admin/family)
import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Birthday } from "../api/types";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Confirmation } from "../components/Confirmation";
import { ErrorBanner } from "../components/ErrorBanner";
import { ScreenTitle } from "../components/ScreenTitle";
import { Icon } from "../components/icons";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

// Hoisted row helper
function BirthdayRow({ b, canEdit, onDelete }:
  { b: Birthday; canEdit: boolean; onDelete: (b: Birthday) => void }) {
  const when = `${MONTHS[b.month - 1]} ${b.day}${b.year ? `, ${b.year}` : ""}`;
  return (
    <li className="well rounded-[22px] p-4 flex items-center gap-4 flex-wrap">
      <Icon name="cake" size={32} className="text-brand shrink-0" />
      <span className="text-big font-bold flex-1 min-w-[8rem]">{b.name}</span>
      <span className="text-big">{when}</span>
      {canEdit && (
        <button type="button" onClick={() => onDelete(b)} aria-label={`Delete ${b.name}`}
                className="chrome pressable rounded-[18px] w-16 h-16 inline-flex items-center justify-center shrink-0">
          <Icon name="trash" size={26} />
        </button>
      )}
    </li>
  );
}

export function Birthdays({ canEdit }: { canEdit: boolean }) {
  const [list, setList] = useState<Birthday[]>([]);
  const [name, setName] = useState("");
  const [month, setMonth] = useState(1);
  const [day, setDay] = useState(1);
  const [year, setYear] = useState<number | "">("");
  const [toDelete, setToDelete] = useState<Birthday | null>(null);
  const [ack, setAck] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  function load(): void {
    api.get<Birthday[]>("/api/birthdays").then(setList)
      .catch(() => setError("Couldn't load the birthdays. Please try again."));
  }
  useEffect(() => { load(); }, []);

  async function add(): Promise<void> {
    if (!name.trim()) { setFormError("Enter a name."); return; }
    if (day < 1 || day > 31) { setFormError("Enter a day between 1 and 31."); return; }
    setFormError(null);
    try {
      await api.post("/api/birthdays", {
        name: name.trim(), month, day, year: year === "" ? null : year,
      });
      setName(""); setMonth(1); setDay(1); setYear("");
      setAck("Birthday added");
      load();
    } catch {
      setError("Couldn't add the birthday. Please try again.");
    }
  }

  async function remove(id: number): Promise<void> {
    setToDelete(null);
    try {
      await api.delete(`/api/birthdays/${id}`);
      setAck("Birthday removed");
      load();
    } catch {
      setError("Couldn't remove the birthday. Please try again.");
    }
  }

  const fieldCls = "field rounded-[20px] px-5 text-big";

  return (
    <div className="flex flex-col gap-6">
      {ack && <Confirmation message={ack} onDone={() => setAck(null)} />}
      {error && <ErrorBanner message={error} onDone={() => setError(null)} />}
      <ScreenTitle>Birthdays</ScreenTitle>

      <Card>
        {list.length === 0 ? (
          <p className="m-0 text-big text-ink-soft">No birthdays yet.</p>
        ) : (
          <ul className="m-0 p-0 list-none flex flex-col gap-3">
            {list.map(b => <BirthdayRow key={b.id} b={b} canEdit={canEdit} onDelete={setToDelete} />)}
          </ul>
        )}
      </Card>

      {canEdit && (
        <Card title="Add a birthday" icon="cake">
          {formError && (
            <p role="alert" className="m-0 text-big font-bold text-danger flex items-center gap-3">
              <Icon name="alert" size={30} />{formError}
            </p>
          )}
          <label className="flex flex-col gap-1 text-base font-bold">Name
            <input className={fieldCls} value={name} onChange={e => setName(e.target.value)} aria-label="Name" /></label>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="flex flex-col gap-1 text-base font-bold">Month
              <select className={fieldCls} value={month} onChange={e => setMonth(Number(e.target.value))} aria-label="Month">
                {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select></label>
            <label className="flex flex-col gap-1 text-base font-bold">Day
              <input type="number" inputMode="numeric" className={fieldCls} value={day} min={1} max={31}
                     onChange={e => setDay(Number(e.target.value))} aria-label="Day" /></label>
            <label className="flex flex-col gap-1 text-base font-bold"><span>Year <span className="font-normal text-ink-soft">(optional)</span></span>
              <input type="number" inputMode="numeric" className={fieldCls} value={year} min={1900} max={2030}
                     onChange={e => setYear(e.target.value === "" ? "" : Number(e.target.value))} aria-label="Year (optional)" /></label>
          </div>
          <div>
            <Button onClick={add} icon={<Icon name="plus" strokeWidth={2.8} />}>Add birthday</Button>
          </div>
        </Card>
      )}

      <ConfirmDialog
        open={!!toDelete}
        title="Remove this birthday?"
        body={toDelete?.name}
        confirmLabel="Remove"
        cancelLabel="Keep"
        onConfirm={() => toDelete && remove(toDelete.id)}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
