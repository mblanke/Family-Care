// api/types.ts
export interface Occurrence {
  appointment_id: number;
  title: string;
  start: string;
  end: string | null;
  location: string | null;
  person_id: number | null;
  for_both: boolean;
  needs_ride: boolean;
  notes: string | null;
}
export interface Todo {
  id: number;
  text: string;
  done: boolean;
  assignee_id: number | null;
  done_at: string | null;
}
export interface GroceryItem {
  id: number;
  name: string;
  store: "costco" | "grocery" | "either";
  qty: number;
  checked: boolean;
}
export interface Upcoming {
  birthday_id: number;
  name: string;
  next_date: string;
  days_until: number;
  turning: number | null;
}
export interface TodayData {
  appointments: Occurrence[];
  rides_today: Occurrence[];
  open_todos: Todo[];
  upcoming_birthdays: Upcoming[];
}
export interface WeekDay {
  date: string;
  appointments: Occurrence[];
}
export interface WeekData {
  week_start: string;
  days: WeekDay[];
  driver_runs: Occurrence[];
}
export interface Birthday {
  id: number;
  name: string;
  month: number;
  day: number;
  year: number | null;
}
export interface PersonApi {
  id: number;
  name: string;
  slug: string;
  color: string;
}
