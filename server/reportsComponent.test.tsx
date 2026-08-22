// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ loading: false }));

vi.mock("@/stores/posStore", () => ({ usePosStore: () => ({ activeLocationId: 2, user: { id: 5, name: "Maria Santos", role: "manager" } }) }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    reports: {
      locationDashboard: { useQuery: () => ({ isLoading: mocks.loading, error: null, data: { revenue: "2500.00", transactionCount: 4, topProducts: [] } }) },
      locationComparison: { useQuery: () => ({ isLoading: mocks.loading, error: null, data: [] }) },
      cashSessions: { useQuery: () => ({ isLoading: mocks.loading, error: null, data: { openCount: 1, closedCount: 2, sessions: [], totalVariance: "0.00" } }) },
      loyalty: { useQuery: () => ({ isLoading: mocks.loading, error: null, data: { activeMembers: 10, enrolledToday: 1, pointsIssuedToday: 5, pointsReversedToday: 0, adjustmentsToday: 0, topMembers: [] } }) },
    },
    inventory: { lowStock: { useQuery: () => ({ isLoading: mocks.loading, error: null, data: [] }) } },
  },
}));

import Reports from "../client/src/pages/Reports";

describe("Reports workspace", () => {
  beforeEach(() => { mocks.loading = false; });
  afterEach(cleanup);

  it("shows the explicit loading experience before protected reporting data resolves", () => {
    mocks.loading = true;
    render(<Reports />);
    expect(screen.getByText("Loading live location reports…")).toBeInTheDocument();
  });

  it("renders the selected-location report content after data resolves", () => {
    render(<Reports />);
    expect(screen.getByRole("heading", { name: "Reports" })).toBeInTheDocument();
    expect(screen.getByText("Today’s revenue")).toBeInTheDocument();
    expect(screen.getByText("Low-stock alerts")).toBeInTheDocument();
    expect(screen.getByText("Top loyalty members")).toBeInTheDocument();
  });
});
