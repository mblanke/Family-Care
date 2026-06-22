import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { Medications } from "./Medications";
import { api } from "../api/client";
import * as auth from "../lib/auth";

vi.mock("../api/client");
beforeEach(() => {
  vi.spyOn(auth, "useAuth").mockReturnValue({ user: { role: "family" } } as any);
  (api.get as any) = vi.fn().mockImplementation((p: string) => {
    if (p === "/api/people") return Promise.resolve([{ id: 1, name: "Dad", slug: "dad", color: "#1f6feb" }]);
    if (p.includes("/medications")) return Promise.resolve({
      regimen: [{ id: 9, name: "Amlodipine", dose: "5 mg", slot: "morning", purpose: "BP",
        prescriber: "Dr. Lee", prn: false, active: true, pack_pickup: null }],
      history: [{ id: 1, change_type: "added", summary: "Started Amlodipine 5 mg (morning)",
        reason: null, recorded_at: "2026-06-01T10:00:00", medication_id: 9 }],
    });
    return Promise.resolve([]);
  });
});

describe("Medications", () => {
  it("shows the not-medical-advice line and hides edit controls for family", async () => {
    render(<Medications />);
    await waitFor(() => screen.getByText("Amlodipine"));
    expect(screen.getByText(/not medical advice/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /change dose/i })).toBeNull();
  });
});
