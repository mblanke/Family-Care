// Birthdays.tsx — list + add/delete (admin/family)
import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Birthday } from "../api/types";
import { Button } from "../components/Button";
import { ConfirmDialog } from "../components/ConfirmDialog";

// Hoisted row helper
function BirthdayRow({ b, canEdit, onDelete }:
  { b: Birthday; canEdit: boolean; onDelete: (id: number) => void }) {
  const monthName = new Date(b.year ?? 2000, b.month - 1, b.day)
    .toLocaleDateString(undefined, { month: "long", day: "numeric" });
  return (
    <li className="flex items-center gap-4 border-4 rounded-2xl p-4">
      <span className="text-big flex-1">
        🎂 {b.name} — {monthName}{b.year ? ` ${b.year}` : ""}
      </span>
      {canEdit && (
        <button onClick={() => onDelete(b.id)} aria-label={`Delete ${b.name}`}
                className="min-h-touch px-4 text-big">🗑</button>
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

  function load(): void {
    api.get<Birthday[]>("/api/birthdays").then(setList).catch(console.error);
  }
  useEffect(() => { load(); }, []);

  async function add(): Promise<void> {
    if (!name.trim()) return;
    await api.post("/api/birthdays", {
      name: name.trim(), month, day, year: year === "" ? null : year,
    }).catch(console.error);
    setName(""); setMonth(1); setDay(1); setYear("");
    load();
  }

  async function remove(id: number): Promise<void> {
    setToDelete(null);
    await api.delete(`/api/birthdays/${id}`).catch(console.error);
    load();
  }

  return (
    <div className="p-6 flex flex-col gap-6">
      <h2 className="text-huge font-bold">Birthdays</h2>
      <ul className="flex flex-col gap-3">
        {list.map(b => (
          <BirthdayRow key={b.id} b={b} canEdit={canEdit} onDelete={id => setToDelete(list.find(x => x.id === id)!)} />
        ))}
      </ul>
      {canEdit && (
        <div className="flex flex-col gap-3">
          <h3 className="text-big font-bold">Add Birthday</h3>
          <input className="text-big p-4 border-4 rounded-xl" placeholder="Name"
            value={name} onChange={e => setName(e.target.value)} aria-label="Name" />
          <div className="flex gap-3">
            <input type="number" className="text-big p-4 border-4 rounded-xl w-24" placeholder="Month"
              value={month} min={1} max={12}
              onChange={e => setMonth(Number(e.target.value))} aria-label="Month" />
            <input type="number" className="text-big p-4 border-4 rounded-xl w-24" placeholder="Day"
              value={day} min={1} max={31}
              onChange={e => setDay(Number(e.target.value))} aria-label="Day" />
            <input type="number" className="text-big p-4 border-4 rounded-xl w-28" placeholder="Year (optional)"
              value={year} min={1900} max={2030}
              onChange={e => setYear(e.target.value === "" ? "" : Number(e.target.value))} aria-label="Year (optional)" />
          </div>
          <Button onClick={add}>Add Birthday</Button>
        </div>
      )}
      <ConfirmDialog
        open={!!toDelete}
        title="Remove birthday?"
        body={toDelete?.name}
        confirmLabel="Remove"
        onConfirm={() => toDelete && remove(toDelete.id)}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
