import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { Today } from "./Today";
import { api } from "../api/client";

vi.mock("../api/client");

beforeEach(() => {
  (api.get as any) = vi.fn().mockImplementation((p: string) => {
    if (p === "/api/people") return Promise.resolve([{ id: 2, name: "Dad", slug: "dad", color: "#1f6feb" }]);
    return Promise.resolve({
      appointments: [{ appointment_id: 1, title: "Cardiology", start: "2026-09-25T09:30:00", end: null,
        location: "Main Street clinic", person_id: 2, for_both: false, needs_ride: true, notes: null }],
      rides_today: [],
      open_todos: [{ id: 7, text: "Call the pharmacy", done: false, assignee_id: null, done_at: null }],
      upcoming_birthdays: [{ birthday_id: 1, name: "Mom", next_date: "2026-09-26", days_until: 1, turning: 78 }],
    });
  });
});

describe("Today", () => {
  it("shows appointments with the ride badge and person, open to-dos, and 'tomorrow' for one day out", async () => {
    render(<Today />);
    await waitFor(() => screen.getByText("Cardiology"));
    expect(screen.getByText(/needs a ride/i)).toBeTruthy();
    expect(screen.getByText("Dad")).toBeTruthy();
    expect(screen.getByText("Call the pharmacy")).toBeTruthy();
    expect(screen.getByText(/tomorrow/)).toBeTruthy();
  });

  it("offers a retry when today cannot be loaded", async () => {
    (api.get as any) = vi.fn().mockRejectedValue(new Error("down"));
    render(<Today />);
    await waitFor(() => screen.getByRole("alert"));
    expect(screen.getByRole("button", { name: /try again/i })).toBeTruthy();
  });
});
