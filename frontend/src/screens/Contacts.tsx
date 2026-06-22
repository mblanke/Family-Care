import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../lib/auth";
import { Button } from "../components/Button";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { ErrorBanner } from "../components/ErrorBanner";

interface Contact {
  id: number;
  name: string;
  role: string;
  phone: string;
  address: string | null;
  notes: string | null;
  person_id: number | null;
  is_emergency: boolean;
}

const ROLE: Record<string, { icon: string; label: string }> = {
  doctor: { icon: "🩺", label: "Doctor" },
  paramedics: { icon: "🚑", label: "Paramedics" },
  occupational_therapist: { icon: "🧑‍⚕️", label: "Occupational Therapist" },
  pharmacist: { icon: "💊", label: "Pharmacist" },
  other: { icon: "📇", label: "Other" },
};

function Card({ c, canEdit, onDelete }: { c: Contact; canEdit: boolean; onDelete: (c: Contact) => void }) {
  const r = ROLE[c.role] ?? ROLE.other;
  return (
    <div className="border-4 rounded-2xl p-4 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className="text-big font-bold flex-1">{c.name}</span>
        <span className="text-base font-semibold border-2 rounded-xl px-3 py-1">
          {r.icon} {r.label}
        </span>
      </div>
      {c.notes && <p className="text-base">{c.notes}</p>}
      <a
        href={`tel:${c.phone}`}
        aria-label={`Call ${c.name}`}
        className="min-h-touch rounded-2xl bg-confirm text-paper text-big font-bold
                   inline-flex items-center justify-center gap-3 w-full"
      >
        📞 Call {c.name}
      </a>
      {c.address && (
        <a
          href={`https://maps.google.com/?q=${encodeURIComponent(c.address)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-base underline"
        >
          📍 {c.address}
        </a>
      )}
      {canEdit && (
        <button
          onClick={() => onDelete(c)}
          className="min-h-touch px-4 border-4 rounded-xl text-base self-start"
        >
          🗑 Remove
        </button>
      )}
    </div>
  );
}

export function Contacts() {
  const { user } = useAuth();
  const canEdit = user?.role === "admin" || user?.role === "family";
  const [list, setList] = useState<Contact[]>([]);
  const [toDelete, setToDelete] = useState<Contact | null>(null);
  const [form, setForm] = useState({ name: "", role: "doctor", phone: "", is_emergency: false, address: "" });
  const [error, setError] = useState<string | null>(null);

  function load() {
    api.get<Contact[]>("/api/contacts").then(setList).catch(() => {});
  }
  useEffect(() => { load(); }, []);

  async function add() {
    if (!form.name || !form.phone) return;
    try {
      await api.post("/api/contacts", { ...form, address: form.address || null });
      setForm({ name: "", role: "doctor", phone: "", is_emergency: false, address: "" });
      load();
    } catch {
      setError("Couldn't add contact — please try again.");
    }
  }

  async function remove(c: Contact) {
    setToDelete(null);
    try {
      await api.delete(`/api/contacts/${c.id}`);
      load();
    } catch {
      setError("Couldn't delete contact — please try again.");
    }
  }

  const emergency = list.filter(c => c.is_emergency);
  const rest = list.filter(c => !c.is_emergency);

  return (
    <div className="p-6 flex flex-col gap-6">
      {error && <ErrorBanner message={error} onDone={() => setError(null)} />}
      <h2 className="text-huge font-bold">Contacts</h2>

      {emergency.length > 0 && (
        <section className="flex flex-col gap-3">
          <h3 className="text-big font-bold">🚨 Emergency</h3>
          {emergency.map(c => (
            <Card key={c.id} c={c} canEdit={canEdit} onDelete={setToDelete} />
          ))}
        </section>
      )}

      {rest.length > 0 && (
        <section className="flex flex-col gap-3">
          {rest.map(c => (
            <Card key={c.id} c={c} canEdit={canEdit} onDelete={setToDelete} />
          ))}
        </section>
      )}

      {canEdit && (
        <div className="border-4 rounded-2xl p-4 flex flex-col gap-3 max-w-xl">
          <input
            className="text-big p-3 border-4 rounded-xl"
            placeholder="Name"
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
          />
          <input
            className="text-big p-3 border-4 rounded-xl"
            placeholder="Phone"
            value={form.phone}
            onChange={e => setForm({ ...form, phone: e.target.value })}
          />
          <input
            className="text-big p-3 border-4 rounded-xl"
            placeholder="Address (optional)"
            value={form.address}
            onChange={e => setForm({ ...form, address: e.target.value })}
          />
          <select
            className="text-big p-3 border-4 rounded-xl"
            value={form.role}
            onChange={e => setForm({ ...form, role: e.target.value })}
          >
            {Object.entries(ROLE).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          <label className="text-big flex items-center gap-3">
            <input
              type="checkbox"
              className="w-8 h-8"
              checked={form.is_emergency}
              onChange={e => setForm({ ...form, is_emergency: e.target.checked })}
            />
            🚨 Emergency contact
          </label>
          <Button onClick={add} icon={<span aria-hidden>＋</span>} aria-label="Add contact">
            Add contact
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={!!toDelete}
        title="Remove this contact?"
        body={toDelete?.name}
        confirmLabel="Remove"
        onConfirm={() => toDelete && remove(toDelete)}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
