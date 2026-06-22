import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Todo } from "../api/types";
import { Button } from "../components/Button";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Confirmation } from "../components/Confirmation";
import { ErrorBanner } from "../components/ErrorBanner";

// Hoisted to module scope — not inside render — to avoid remount/focus churn
function Row({ t, onToggle, onDelete }:
  { t: Todo; onToggle: (t: Todo) => void; onDelete: (t: Todo) => void }) {
  return (
    <li className="flex items-center gap-4 border-4 rounded-2xl p-4">
      <button
        onClick={() => onToggle(t)}
        aria-label={t.done ? "Uncheck" : "Check"}
        className={`w-14 h-14 rounded-xl border-4 flex items-center justify-center text-huge
                    ${t.done ? "bg-confirm text-paper" : ""} transition-transform active:scale-90`}
      >
        {t.done ? "✓" : ""}
      </button>
      <span className={`flex-1 text-big ${t.done ? "line-through" : ""}`}>{t.text}</span>
      <button onClick={() => onDelete(t)} aria-label="Delete" className="min-h-touch px-4 text-big">🗑</button>
    </li>
  );
}

export function TodoScreen() {
  const [items, setItems] = useState<Todo[]>([]);
  const [text, setText] = useState("");
  const [ack, setAck] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Todo | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    api.get<Todo[]>("/api/todos")
      .then(setItems)
      .catch((err) => console.error("Failed to load todos:", err));
  }
  useEffect(() => { load(); }, []);

  async function add() {
    if (!text.trim()) return;
    try {
      await api.post("/api/todos", { text: text.trim() });
      setText("");
      setAck("Added to the list");
      load();
    } catch {
      setError("Couldn't add item — please try again.");
    }
  }

  async function toggle(t: Todo) {
    try {
      await api.post(`/api/todos/${t.id}/done`, { done: !t.done });
      if (!t.done) setAck("Checked off ✓");
      load();
    } catch {
      setError("Couldn't save — please try again.");
    }
  }

  async function remove(t: Todo) {
    setToDelete(null);
    try {
      await api.delete(`/api/todos/${t.id}`);
      load();
    } catch {
      setError("Couldn't delete item — please try again.");
    }
  }

  const open = items.filter(i => !i.done);
  const done = items.filter(i => i.done);

  return (
    <div className="p-6 flex flex-col gap-6">
      {ack && <Confirmation message={ack} onDone={() => setAck(null)} />}
      {error && <ErrorBanner message={error} onDone={() => setError(null)} />}
      <div className="flex gap-touch">
        <input
          className="flex-1 text-big p-4 border-4 rounded-xl"
          placeholder="Add an item"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === "Enter" && add()}
          aria-label="New to-do item"
        />
        <Button onClick={add} icon={<span aria-hidden>＋</span>}>Add</Button>
      </div>
      <ul className="flex flex-col gap-3">
        {open.map(t => <Row key={t.id} t={t} onToggle={toggle} onDelete={setToDelete} />)}
      </ul>
      <h3 className="text-big font-bold mt-4">Done</h3>
      <ul className="flex flex-col gap-3 opacity-70">
        {done.map(t => <Row key={t.id} t={t} onToggle={toggle} onDelete={setToDelete} />)}
      </ul>
      <ConfirmDialog
        open={!!toDelete}
        title="Remove this item?"
        body={toDelete?.text}
        confirmLabel="Remove"
        onConfirm={() => toDelete && remove(toDelete)}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
