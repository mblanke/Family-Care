import { describe, it, expect } from "vitest";
import { formatTime } from "./format";

describe("formatTime", () => {
  it("renders a 12-hour time with am/pm", () => {
    expect(formatTime("2026-06-22T14:05:00")).toMatch(/2:05\s?pm/i);
  });
});
