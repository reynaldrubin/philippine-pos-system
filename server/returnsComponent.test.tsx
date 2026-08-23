// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/stores/posStore", () => ({
  usePosStore: (selector?: (state: unknown) => unknown) => {
    const state = { activeLocationId: 3, user: { id: 7, name: "Store Manager", role: "manager" } };
    return selector ? selector(state) : state;
  },
}));
vi.mock("@/lib/trpc", () => ({ trpc: { returns: {
  get: { useQuery: () => ({ data: undefined, isLoading: false, error: null }) },
  process: { useMutation: () => ({ isPending: false, mutate: vi.fn() }) },
}, cashSessions: { list: { useQuery: () => ({ data: [], isLoading: false, error: null }) } } } }));

import Returns from "../client/src/pages/Returns";

describe("partial returns workspace", () => {
  afterEach(cleanup);

  it("presents an authorized manager sale lookup with immutable sales-record guidance", () => {
    render(<Returns />);
    expect(screen.getByRole("heading", { name: "Partial returns" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Find original sale" })).toBeInTheDocument();
    expect(screen.getByText(/preserve the completed sale record/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Sale ID")).toBeInTheDocument();
  });
});
