import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Person } from "./people";
import { PersonBadge } from "../components/PersonBadge";

export function usePersonPicker() {
  const [people, setPeople] = useState<Person[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  useEffect(() => {
    void api.get<Person[]>("/api/people")
      .then(ps => { setPeople(ps); setSelected(ps[0]?.id ?? null); })
      .catch(() => { /* no-op: network failure leaves picker empty */ });
  }, []);
  const picker = (
    <div className="flex gap-touch flex-wrap">
      {people.map(p => (
        <button key={p.id} onClick={() => setSelected(p.id)}
          className={`min-h-touch rounded-xl ${selected === p.id ? "ring-4" : "opacity-70"}`}>
          <PersonBadge person={p} />
        </button>
      ))}
    </div>
  );
  return { people, selected, picker };
}
