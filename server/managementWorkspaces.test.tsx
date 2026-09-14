// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ loading: false }));

vi.mock("@/stores/posStore", () => ({
  usePosStore: () => ({
    activeLocationId: 2,
    user: { id: 5, name: "Maria Santos", role: "manager" },
    locations: [{ id: 2, code: "BGC", name: "BGC Store", type: "store", isPrimary: true }, { id: 3, code: "MAK", name: "Makati Store", type: "store", isPrimary: false }],
  }),
}));
vi.mock("@/lib/trpc", () => {
  const query = (data: unknown) => () => ({ isLoading: mocks.loading, error: null, data, refetch: vi.fn() });
  const mutation = () => ({ isPending: false, error: null, mutate: vi.fn() });
  return { trpc: {
    useUtils: () => ({ categories: { list: { invalidate: vi.fn() } }, locations: { list: { invalidate: vi.fn() } } }),
    inventory: { list: { useQuery: query([]) }, lowStock: { useQuery: query([]) }, movements: { useQuery: query([]) }, adjust: { useMutation: mutation }, settings: { useMutation: mutation } },
    categories: { list: { useQuery: query([]) }, create: { useMutation: mutation }, archive: { useMutation: mutation } },
    products: { list: { useQuery: query([]) }, create: { useMutation: mutation }, update: { useMutation: mutation }, archive: { useMutation: mutation } },
    stockTransfers: { list: { useQuery: query([]) }, request: { useMutation: mutation }, ship: { useMutation: mutation }, receive: { useMutation: mutation }, cancel: { useMutation: mutation } },
    locations: { registers: { useQuery: query([]) }, list: { useQuery: query([]) }, createRegister: { useMutation: mutation }, create: { useMutation: mutation }, update: { useMutation: mutation } },
    cashSessions: { list: { useQuery: query([]) }, open: { useMutation: mutation }, close: { useMutation: mutation } },
    operations: { cashMovements: { list: { useQuery: query([]) }, create: { useMutation: mutation } }, attendance: { list: { useQuery: query([]) }, record: { useMutation: mutation } } },
    staff: { list: { useQuery: query([]) } },
  } };
});

import Inventory from "../client/src/pages/Inventory";
import Operations from "../client/src/pages/Operations";
import Transfers from "../client/src/pages/Transfers";

describe("protected management workspaces", () => {
  beforeEach(() => { mocks.loading = false; });
  afterEach(cleanup);

  it("renders Inventory loading and management content", () => {
    mocks.loading = true;
    const loading = render(<Inventory />);
    expect(screen.getByText("Loading inventory and catalog controls…")).toBeInTheDocument();
    loading.unmount(); mocks.loading = false;
    render(<Inventory />);
    expect(screen.getByRole("heading", { name: "Inventory & catalog" })).toBeInTheDocument();
    expect(screen.getByText("Immutable stock movement history")).toBeInTheDocument();
  });

  it("renders Transfers loading and queue content", () => {
    mocks.loading = true;
    const loading = render(<Transfers />);
    expect(screen.getByText("Loading transfer inventory and queue…")).toBeInTheDocument();
    loading.unmount(); mocks.loading = false;
    render(<Transfers />);
    expect(screen.getByRole("heading", { name: "Stock transfers" })).toBeInTheDocument();
    expect(screen.getByText("Transfer queue")).toBeInTheDocument();
  });

  it("renders Operations loading and branch controls", () => {
    mocks.loading = true;
    const loading = render(<Operations />);
    expect(screen.getByText("Loading branch operations…")).toBeInTheDocument();
    loading.unmount(); mocks.loading = false;
    render(<Operations />);
    expect(screen.getByRole("heading", { name: "Operations" })).toBeInTheDocument();
    expect(screen.getByText("Cash sessions")).toBeInTheDocument();
    expect(screen.getByText("Cash drawer movements")).toBeInTheDocument();
    expect(screen.getByText("Staff attendance")).toBeInTheDocument();
  });
});
