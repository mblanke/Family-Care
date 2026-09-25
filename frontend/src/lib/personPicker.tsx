import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Person } from "./people";

// Chrome tray of person chips; the chosen one is lit in brand metal, with the person's dot beside the name.
export function usePersonPicker() {
  const [people, setPeople] = useState<Person[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  useEffect(() => {
    void api.get<Person[]>("/api/people")
      .then(ps => { setPeople(ps); setSelected(ps[0]?.id ?? null); })
      .catch(() => { /* no-op: network failure leaves picker empty */ });
  }, []);
  const picker = (
    <div role="group" aria-label="Whose record" className="chrome rounded-pill p-1.5 inline-flex gap-1.5 flex-wrap">
      {people.map(p => {
        const active = selected === p.id;
        return (
          <button key={p.id} type="button" onClick={() => setSelected(p.id)} aria-pressed={active}
            className={`min-h-[56px] px-5 rounded-pill text-base font-bold pressable inline-flex items-center gap-2
              ${active ? "btn-primary" : "bg-transparent border-0 shadow-none text-ink"}`}>
            <span aria-hidden className="w-4 h-4 rounded-full shrink-0 border-[3px]"
                  style={{ background: active ? "#ffffff" : p.color, borderColor: p.color }} />
            {p.name}
          </button>
        );
      })}
    </div>
  );
  return { people, selected, picker };
}
