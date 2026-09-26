// admin/AdminLayout.tsx — fuller nav; wraps to iPhone width (3 columns) and one row on wide screens
import { useState } from "react";
import { NavPills, type NavTab } from "../components/NavPills";
import { Today } from "../screens/Today";
import { TodoScreen } from "../screens/TodoScreen";
import { GroceryScreen } from "../screens/GroceryScreen";
import { Schedule } from "../screens/Schedule";
import { Birthdays } from "../screens/Birthdays";
import { Medications } from "../screens/Medications";
import { BpLog } from "../screens/BpLog";
import { MonthView } from "./MonthView";
import { Accounts } from "./Accounts";
import { Contacts } from "../screens/Contacts";

type Tab = "today" | "schedule" | "todo" | "grocery" | "birthdays" | "meds" | "bp" | "accounts" | "contacts";
const TABS: NavTab<Tab>[] = [
  { id: "today", label: "Today", icon: "sun" },
  { id: "schedule", label: "Schedule", icon: "calendar" },
  { id: "todo", label: "To-do", icon: "list" },
  { id: "grocery", label: "Grocery", icon: "cart" },
  { id: "birthdays", label: "Birthdays", icon: "cake" },
  { id: "meds", label: "Medications", icon: "pill" },
  { id: "bp", label: "Blood pressure", icon: "heart" },
  { id: "accounts", label: "Accounts", icon: "key" },
  { id: "contacts", label: "Contacts", icon: "person" },
];

export function AdminLayout() {
  const [tab, setTab] = useState<Tab>("today");
  return (
    <div className="flex flex-col gap-6">
      <NavPills tabs={TABS} value={tab} onChange={setTab} columns="grid-cols-3 sm:grid-cols-5 lg:grid-cols-9" layout="stacked" />
      {tab === "today" && <Today />}
      {tab === "schedule" && <><Schedule canEdit /><MonthView /></>}
      {tab === "todo" && <TodoScreen />}
      {tab === "grocery" && <GroceryScreen />}
      {tab === "birthdays" && <Birthdays canEdit />}
      {tab === "meds" && <Medications />}
      {tab === "bp" && <BpLog />}
      {tab === "accounts" && <Accounts />}
      {tab === "contacts" && <Contacts />}
    </div>
  );
}
