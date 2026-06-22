import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { GroceryItem } from "../api/types";
import { Button } from "../components/Button";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Confirmation } from "../components/Confirmation";

type Filter = "costco" | "grocery" | "all";
const STORE_LABEL: Record<string, string> = {
  costco: "Costco",
  grocery: "Grocery",
  either: "Either",
};

// Hoisted to module scope — not inside render — to avoid remount/focus churn
function Seg({
  id,
  label,
  active,
  onClick,
}: {
  id: Filter;
  label: string;
  active: boolean;
  onClick: (id: Filter) => void;
}) {
  return (
    <button
      onClick={() => onClick(id)}
      className={`flex-1 min-h-touch text-big font-bold rounded-2xl ${
        active ? "bg-brand text-paper" : "border-4"
      }`}
    >
      {label}
    </button>
  );
}

export function GroceryScreen() {
  const [items, setItems] = useState<GroceryItem[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [name, setName] = useState("");
  const [store, setStore] = useState<"costco" | "grocery" | "either">("either");
  const [ack, setAck] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  function load() {
    api
      .get<GroceryItem[]>(`/api/grocery?store=${filter}`)
      .then(setItems)
      .catch((err) => console.error("Failed to load grocery items:", err));
  }
  useEffect(() => {
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  async function add() {
    if (!name.trim()) return;
    await api.post("/api/grocery", { name: name.trim(), store });
    setName("");
    setAck("Added");
    load();
  }

  async function check(i: GroceryItem) {
    await api.post(`/api/grocery/${i.id}/check`, { checked: !i.checked });
    load();
  }

  async function step(i: GroceryItem, d: number) {
    await api.post(`/api/grocery/${i.id}/qty`, { qty: i.qty + d });
    load();
  }

  async function clear() {
    await api.post("/api/grocery/clear-checked");
    setConfirmClear(false);
    setAck("Cleared checked items");
    load();
  }

  // Group by store for display; within a group, unchecked first then checked (greyed)
  const groups =
    filter === "all"
      ? (["costco", "grocery", "either"] as const).map(
          (s) =>
            [STORE_LABEL[s], items.filter((i) => i.store === s)] as const
        )
      : [[STORE_LABEL[filter], items] as const];

  return (
    <div className="p-6 flex flex-col gap-6">
      {ack && <Confirmation message={ack} onDone={() => setAck(null)} />}

      {/* Segmented control — text labels, not color-only */}
      <div className="flex gap-touch">
        <Seg id="costco" label="Costco" active={filter === "costco"} onClick={setFilter} />
        <Seg id="grocery" label="Grocery" active={filter === "grocery"} onClick={setFilter} />
        <Seg id="all" label="All" active={filter === "all"} onClick={setFilter} />
      </div>

      {/* Add item row */}
      <div className="flex gap-touch flex-wrap">
        <input
          className="flex-1 text-big p-4 border-4 rounded-xl"
          placeholder="Add an item"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          aria-label="New grocery item"
        />
        <select
          className="text-big p-4 border-4 rounded-xl"
          value={store}
          onChange={(e) => setStore(e.target.value as typeof store)}
          aria-label="Store"
        >
          <option value="either">Either</option>
          <option value="costco">Costco</option>
          <option value="grocery">Grocery</option>
        </select>
        <Button onClick={add} icon={<span aria-hidden>＋</span>}>
          Add
        </Button>
      </div>

      {/* Groups with large section headers */}
      {groups.map(([label, list]) => (
        <section key={label}>
          <h3 className="text-big font-bold mb-2">{label}</h3>
          <ul className="flex flex-col gap-3">
            {[...list]
              .sort((a, b) => Number(a.checked) - Number(b.checked))
              .map((i) => (
                <li
                  key={i.id}
                  className={`flex items-center gap-4 border-4 rounded-2xl p-4 ${
                    i.checked ? "opacity-50" : ""
                  }`}
                >
                  {/* Checkbox — ≥ touch size */}
                  <button
                    onClick={() => check(i)}
                    aria-label={i.checked ? "Uncheck" : "Check"}
                    className={`w-14 h-14 rounded-xl border-4 text-huge flex items-center justify-center ${
                      i.checked ? "bg-confirm text-paper" : ""
                    }`}
                  >
                    {i.checked ? "✓" : ""}
                  </button>

                  <span
                    className={`flex-1 text-big ${i.checked ? "line-through" : ""}`}
                  >
                    {i.name}
                  </span>

                  {/* Qty stepper — large buttons */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => step(i, -1)}
                      className="w-14 h-14 border-4 rounded-xl text-big flex items-center justify-center"
                      aria-label="Less"
                    >
                      −
                    </button>
                    <span className="text-big w-8 text-center">{i.qty}</span>
                    <button
                      onClick={() => step(i, 1)}
                      className="w-14 h-14 border-4 rounded-xl text-big flex items-center justify-center"
                      aria-label="More"
                    >
                      ＋
                    </button>
                  </div>
                </li>
              ))}
          </ul>
        </section>
      ))}

      <Button onClick={() => setConfirmClear(true)}>Clear checked</Button>

      <ConfirmDialog
        open={confirmClear}
        title="Clear all checked items?"
        confirmLabel="Clear"
        onConfirm={clear}
        onCancel={() => setConfirmClear(false)}
      />
    </div>
  );
}
