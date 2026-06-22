import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ScanReview } from "./ScanReview";
import { api } from "../api/client";

vi.mock("../api/client");

beforeEach(() => {
  // Scan endpoint uses raw fetch (multipart) — mock global fetch
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          scan_id: "abc",
          candidates: [
            { name: "Amlodipine", dose: "5 mg", slot: "morning", prescriber: "Dr. Lee" },
          ],
        }),
    })
  );
  // Add-to-regimen uses api.post (JSON)
  (api.post as any) = vi.fn().mockResolvedValue({});
});

describe("ScanReview", () => {
  it("shows extracted candidates as editable rows after a scan, pre-filled not saved", async () => {
    render(<ScanReview personId={1} onAdded={() => {}} />);
    const input = screen.getByLabelText(/scan label/i);
    fireEvent.change(input, {
      target: { files: [new File(["x"], "label.jpg", { type: "image/jpeg" })] },
    });
    await waitFor(() => screen.getByDisplayValue("Amlodipine"));
    expect(screen.getByDisplayValue("5 mg")).toBeTruthy();
    expect(screen.getByRole("button", { name: /add to regimen/i })).toBeTruthy();
    // Nothing auto-saved — api.post not called yet
    expect(api.post).not.toHaveBeenCalled();
  });

  it("shows the clinical-safety note when candidates are present", async () => {
    render(<ScanReview personId={1} onAdded={() => {}} />);
    const input = screen.getByLabelText(/scan label/i);
    fireEvent.change(input, {
      target: { files: [new File(["x"], "label.jpg", { type: "image/jpeg" })] },
    });
    await waitFor(() => screen.getByDisplayValue("Amlodipine"));
    expect(screen.getByText(/check each line against the label/i)).toBeTruthy();
  });
});
