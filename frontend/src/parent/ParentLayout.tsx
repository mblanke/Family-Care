// parent/ParentLayout.tsx — today-first, huge tabs, no month/accounts
import { useState } from "react";
import { Today } from "../screens/Today";
import { TodoScreen } from "../screens/TodoScreen";
import { GroceryScreen } from "../screens/GroceryScreen";
import { Medications } from "../screens/Medications";
import { BpLog } from "../screens/BpLog";
type Tab = "today" | "todo" | "grocery" | "meds" | "bp";
export function ParentLayout() {
  const [tab, setTab] = useState<Tab>("today");
  const T = ({ id, label }: { id: Tab; label: string }) => (
    <button onClick={() => setTab(id)}
      className={`flex-1 min-h-touch text-big font-bold rounded-2xl ${tab === id ? "bg-brand text-paper" : "border-4"}`}>
      {label}</button>
  );
  return (
    <div className="flex flex-col gap-4">
      <nav className="flex gap-touch p-4 flex-wrap">
        <T id="today" label="Today" /><T id="todo" label="To-do" /><T id="grocery" label="Grocery" /><T id="meds" label="Medications" /><T id="bp" label="BP" />
      </nav>
      {tab === "today" && <Today />}
      {tab === "todo" && <TodoScreen />}
      {tab === "grocery" && <GroceryScreen />}
      {tab === "meds" && <Medications />}
      {tab === "bp" && <BpLog />}
    </div>
  );
}
