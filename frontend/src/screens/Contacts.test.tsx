import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { Contacts } from "./Contacts";
import { api } from "../api/client";
import * as auth from "../lib/auth";

vi.mock("../api/client");
beforeEach(() => {
  vi.spyOn(auth, "useAuth").mockReturnValue({ user: { role: "parent" } } as any);
  (api.get as any) = vi.fn().mockResolvedValue([
    { id: 1, name: "Ambulance", role: "paramedics", phone: "911", address: null, notes: null,
      person_id: null, is_emergency: true },
    { id: 2, name: "Dr. Lee", role: "doctor", phone: "555-0100", address: null, notes: null,
      person_id: null, is_emergency: false },
  ]);
});

describe("Contacts", () => {
  it("pins emergency contacts and renders tap-to-call tel: links; hides edit for parent", async () => {
    render(<Contacts />);
    await waitFor(() => screen.getByText("Ambulance"));
    expect(screen.getByText(/Emergency/i)).toBeTruthy();
    const call = screen.getByRole("link", { name: /call ambulance/i }) as HTMLAnchorElement;
    expect(call.getAttribute("href")).toBe("tel:911");
    expect(screen.queryByRole("button", { name: /add contact/i })).toBeNull();  // parent: no edit
  });
});
