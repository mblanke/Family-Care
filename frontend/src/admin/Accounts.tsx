import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Person } from "../lib/people";
import { Button } from "../components/Button";

interface Acct {
  id: number;
  username: string;
  display_name: string;
  role: string;
  person_id: number | null;
  is_active: boolean;
}

export function Accounts() {
  const [accts, setAccts] = useState<Acct[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [form, setForm] = useState({
    username: "",
    password: "",
    display_name: "",
    role: "family",
    person_id: "",
  });

  async function load() {
    setAccts(await api.get<Acct[]>("/api/accounts").catch(() => []));
    setPeople(await api.get<Person[]>("/api/people").catch(() => []));
  }

  useEffect(() => { void load(); }, []);

  async function create() {
    await api.post("/api/accounts", {
      ...form,
      person_id: form.role === "parent" && form.person_id ? Number(form.person_id) : null,
    });
    setForm({ username: "", password: "", display_name: "", role: "family", person_id: "" });
    await load();
  }

  return (
    <div className="p-6 flex flex-col gap-4">
      <h2 className="text-huge font-bold">Accounts</h2>
      <div className="border-4 rounded-2xl p-4 flex flex-col gap-3 max-w-xl">
        <input
          className="text-big p-3 border-4 rounded-xl"
          placeholder="Username"
          value={form.username}
          onChange={e => setForm({ ...form, username: e.target.value })}
        />
        <input
          className="text-big p-3 border-4 rounded-xl"
          placeholder="Display name"
          value={form.display_name}
          onChange={e => setForm({ ...form, display_name: e.target.value })}
        />
        <input
          type="password"
          className="text-big p-3 border-4 rounded-xl"
          placeholder="Password"
          value={form.password}
          onChange={e => setForm({ ...form, password: e.target.value })}
        />
        <select
          className="text-big p-3 border-4 rounded-xl"
          value={form.role}
          onChange={e => setForm({ ...form, role: e.target.value })}
        >
          <option value="family">Family</option>
          <option value="parent">Parent</option>
          <option value="admin">Admin</option>
        </select>
        {form.role === "parent" && (
          <select
            className="text-big p-3 border-4 rounded-xl"
            value={form.person_id}
            onChange={e => setForm({ ...form, person_id: e.target.value })}
          >
            <option value="">Link to…</option>
            {people.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        )}
        <Button onClick={create} icon={<span aria-hidden>＋</span>}>
          Create account
        </Button>
      </div>
      <ul className="flex flex-col gap-2">
        {accts.map(a => (
          <li key={a.id} className="text-big border-4 rounded-xl p-3">
            {a.display_name} — {a.role}{a.is_active ? "" : " (inactive)"}
          </li>
        ))}
      </ul>
    </div>
  );
}
