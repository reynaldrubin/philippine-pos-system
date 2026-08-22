// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ updateMutate: vi.fn() }));
const staffMember = { id: 17, name: "Maria Santos", email: "maria@example.com", role: "manager", jobTitle: "Store Manager", isActive: true };

vi.mock("@/stores/posStore", () => ({
  usePosStore: (selector?: (state: { user: any }) => unknown) => {
    const state = { user: { id: 1, name: "Owner", role: "admin" } };
    return selector ? selector(state) : state;
  },
}));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    staff: {
      list: { useQuery: () => ({ data: [staffMember], refetch: vi.fn() }) },
      locations: { useQuery: () => ({ data: [], refetch: vi.fn() }) },
      menuAccess: { useQuery: () => ({ data: { menuKeys: ["overview", "reports"] }, refetch: vi.fn() }) },
      create: { useMutation: () => ({ isPending: false, error: null, mutate: vi.fn() }) },
      update: { useMutation: (options: { onSuccess?: () => void }) => ({ isPending: false, error: null, mutate: (input: unknown) => { mocks.updateMutate(input); options.onSuccess?.(); } }) },
      assignLocation: { useMutation: () => ({ isPending: false, error: null, mutate: vi.fn() }) },
      unassignLocation: { useMutation: () => ({ isPending: false, error: null, mutate: vi.fn() }) },
      assignMenus: { useMutation: () => ({ isPending: false, error: null, mutate: vi.fn() }) },
    },
    locations: { list: { useQuery: () => ({ data: [], refetch: vi.fn() }) } },
  },
}));

import Users from "../client/src/pages/Users";

describe("Admin staff-management workspace", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(cleanup);

  it("renders profile controls and persists an edited Philippine retail hierarchy profile", async () => {
    render(<Users />);
    expect(screen.getByRole("heading", { name: "Staff & access" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByDisplayValue("Maria Santos")).toBeInTheDocument());
    fireEvent.change(screen.getByDisplayValue("Maria Santos"), { target: { value: "Maria Cruz" } });
    fireEvent.click(screen.getByRole("button", { name: "Save staff profile" }));
    expect(mocks.updateMutate).toHaveBeenCalledWith(expect.objectContaining({ userId: 17, name: "Maria Cruz", email: "maria@example.com", role: "manager", jobTitle: "Store Manager" }));
    expect(screen.getByText("Staff profile updated.")).toBeInTheDocument();
  });
});
