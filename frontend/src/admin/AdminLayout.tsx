// admin/AdminLayout.tsx — fuller nav; wraps to iPhone width
import { useState } from "react";
import { Today } from "../screens/Today";
import { TodoScreen } from "../screens/TodoScreen";
import { GroceryScreen } from "../screens/GroceryScreen";
type Tab = "today" | "schedule" | "todo" | "grocery" | "birthdays" | "accounts";
export function AdminLayout() {
  const [tab, setTab] = useState<Tab>("today");
  const tabs: [Tab, string][] = [["today","Today"],["schedule","Schedule"],["todo","To-do"],
    ["grocery","Grocery"],["birthdays","Birthdays"],["accounts","Accounts"]];
  return (
    <div className="flex flex-col gap-4">
      <nav className="flex flex-wrap gap-touch p-4">
        {tabs.map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`min-h-touch px-5 text-base font-bold rounded-2xl ${tab === id ? "bg-brand text-paper" : "border-4"}`}>
            {label}</button>
        ))}
      </nav>
      {tab === "today" && <Today />}
      {tab === "todo" && <TodoScreen />}
      {tab === "grocery" && <GroceryScreen />}
      {/* Schedule / Birthdays / Accounts mounted in later tasks */}
    </div>
  );
}
