// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ setLocation: vi.fn(), clearSession: vi.fn(), setSession: vi.fn(), setActiveLocation: vi.fn() }));

vi.mock("@/stores/posStore", () => ({
  usePosStore: () => ({
    accessToken: "staff-token",
    user: { id: 5, name: "Maria Santos", email: "maria@example.com", role: "manager", jobTitle: "Store Manager" },
    locations: [{ id: 2, code: "BGC", name: "BGC Store", type: "store", isPrimary: true }],
    menuKeys: ["overview", "register", "inventory", "transfers", "members", "operations", "reports"],
    activeLocationId: 2,
    setActiveLocation: mocks.setActiveLocation,
    setSession: mocks.setSession,
    clearSession: mocks.clearSession,
  }),
}));
vi.mock("@/lib/trpc", () => ({ trpc: { staffAuth: { me: { useQuery: () => ({ data: undefined, error: null }) } } } }));
vi.mock("wouter", () => ({ useLocation: () => ["/", mocks.setLocation] }));

import StaffShell from "../client/src/components/StaffShell";

describe("StaffShell protected navigation", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(cleanup);

  it("shows Reports to a manager with assigned Reports access and routes to the workspace", () => {
    render(<StaffShell><div>Protected workspace</div></StaffShell>);
    expect(screen.getByRole("button", { name: "Reports" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Staff & access" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reports" }));
    expect(mocks.setLocation).toHaveBeenCalledWith("/reports");
  });

  it("starts authenticated navigation groups expanded", () => {
    render(<StaffShell><div>Protected workspace</div></StaffShell>);
    expect(screen.getByRole("button", { name: "Reports" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Inventory submenu" })).toBeVisible();
  });
});
