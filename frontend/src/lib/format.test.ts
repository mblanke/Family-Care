import { describe, it, expect } from "vitest";
import { formatTime, formatDate, formatDateTime, formatDaysUntil } from "./format";

describe("formatTime", () => {
  it("renders a 12-hour time with am/pm", () => {
    expect(formatTime("2026-06-22T14:05:00")).toMatch(/2:05\s?pm/i);
  });
});

describe("formatDate", () => {
  it("renders a full month name, day and year from a date-time", () => {
    expect(formatDate("2026-06-01T10:00:00")).toMatch(/June 1, 2026/);
  });
  it("accepts a bare date without shifting the day", () => {
    expect(formatDate("2026-06-01")).toMatch(/June 1, 2026/);
  });
});

describe("formatDateTime", () => {
  it("renders month, day and time without the year", () => {
    expect(formatDateTime("2026-09-24T08:10:00")).toMatch(/September 24, 8:10\s?am/i);
  });
});

describe("formatDaysUntil", () => {
  it("uses today and tomorrow for 0 and 1", () => {
    expect(formatDaysUntil(0)).toBe("today");
    expect(formatDaysUntil(1)).toBe("tomorrow");
    expect(formatDaysUntil(3)).toBe("in 3 days");
  });
});
