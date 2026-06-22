import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { Schedule } from "./Schedule";
import { api } from "../api/client";

vi.mock("../api/client");

const WEEK: import("../api/types").WeekData = {
  week_start: "2026-06-22",
  days: [
    { date: "2026-06-22", appointments: [
      { appointment_id: 1, title: "Soccer practice", start: "2026-06-22T15:00:00",
        end: "2026-06-22T16:00:00", location: "Field", person_id: 2, for_both: false,
        needs_ride: true, notes: null },
    ]},
    { date: "2026-06-23", appointments: [] },
    { date: "2026-06-24", appointments: [] },
    { date: "2026-06-25", appointments: [] },
    { date: "2026-06-26", appointments: [] },
    { date: "2026-06-27", appointments: [] },
    { date: "2026-06-28", appointments: [] },
  ],
  driver_runs: [
    { appointment_id: 1, title: "Soccer practice", start: "2026-06-22T15:00:00",
      end: "2026-06-22T16:00:00", location: "Field", person_id: 2, for_both: false,
      needs_ride: true, notes: null },
  ],
};

beforeEach(() => {
  (api.get as ReturnType<typeof vi.fn>) = vi.fn().mockResolvedValue(WEEK);
});

describe("Schedule", () => {
  it("renders the driver roll-up listing ride-needed runs", async () => {
    render(<Schedule canEdit={false} />);
    await waitFor(() => screen.getByText(/driving this week/i));
    expect(screen.getByText("Soccer practice")).toBeTruthy();
  });
});
