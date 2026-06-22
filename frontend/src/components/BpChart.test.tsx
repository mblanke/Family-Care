import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { BpChart } from "./BpChart";

describe("BpChart", () => {
  it("draws two distinct series and a plain-language legend, not color-only", () => {
    const { container, getByText } = render(
      <BpChart readings={[
        { taken_at: "2026-06-20T09:00:00", systolic: 130, diastolic: 80, pulse: 70 },
        { taken_at: "2026-06-21T09:00:00", systolic: 128, diastolic: 78, pulse: 72 },
      ]} target={null} showPulse={false} />
    );
    const paths = container.querySelectorAll("path");
    expect(paths.length).toBeGreaterThanOrEqual(2);                 // systolic + diastolic
    // one solid, one dashed → distinguished by style, not just color
    const dashed = Array.from(paths).some(p => p.getAttribute("stroke-dasharray"));
    expect(dashed).toBe(true);
    expect(getByText(/Systolic — top number/i)).toBeTruthy();
    expect(getByText(/Diastolic — bottom number/i)).toBeTruthy();
  });
});
