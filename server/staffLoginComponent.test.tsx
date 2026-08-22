// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ownerAuthenticated: false,
  initialized: false,
  statusLoading: false,
  startLogin: vi.fn(),
  setSession: vi.fn(),
  setLocation: vi.fn(),
  loginMutate: vi.fn(),
  bootstrapMutate: vi.fn(),
}));

vi.mock("@/stores/posStore", () => ({
  STAFF_ACCESS_TOKEN_KEY: "tindahan.staff.access-token",
  usePosStore: (selector: (state: { setSession: typeof mocks.setSession }) => unknown) => selector({ setSession: mocks.setSession }),
}));
vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ isAuthenticated: mocks.ownerAuthenticated }) }));
vi.mock("@/const", () => ({ startLogin: mocks.startLogin }));
vi.mock("wouter", () => ({ useLocation: () => ["/login", mocks.setLocation] }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    bootstrap: {
      status: { useQuery: () => ({ isLoading: mocks.statusLoading, data: { initialized: mocks.initialized } }) },
      establishAdminPassword: { useMutation: (options: { onSuccess?: (result: { accessToken: string }) => void }) => ({ isPending: false, error: null, mutate: (input: { password: string }) => { mocks.bootstrapMutate(input); options.onSuccess?.({ accessToken: "bootstrap-token" }); } }) },
    },
    staffAuth: {
      login: { useMutation: (options: { onSuccess?: (session: any) => void }) => ({ isPending: false, error: null, mutate: (input: { identifier: string; password: string }) => { mocks.loginMutate(input); options.onSuccess?.({ accessToken: "staff-token", user: { id: 5, name: "Store Manager", email: "manager@example.com", role: "manager" }, locations: [], menuKeys: ["overview"] }); } }) },
    },
  },
}));

import StaffLogin from "../client/src/pages/StaffLogin";

describe("StaffLogin owner bootstrap interface", () => {
  beforeEach(() => {
    mocks.ownerAuthenticated = false; mocks.initialized = false; mocks.statusLoading = false;
    vi.clearAllMocks(); sessionStorage.clear();
  });
  afterEach(cleanup);

  it("shows the owner sign-in action only for the uninitialized unauthenticated path", () => {
    render(<StaffLogin />);
    const ownerButton = screen.getByRole("button", { name: "Sign in as project owner to initialize Admin" });
    fireEvent.click(ownerButton);
    expect(mocks.startLogin).toHaveBeenCalledOnce();
  });

  it("shows the password initializer for an authenticated owner and submits the selected password", () => {
    mocks.ownerAuthenticated = true;
    render(<StaffLogin />);
    fireEvent.change(screen.getByPlaceholderText("Set 12+ character Admin password"), { target: { value: "TemporaryPass123" } });
    fireEvent.click(screen.getByRole("button", { name: "Initialize" }));
    expect(mocks.bootstrapMutate).toHaveBeenCalledWith({ password: "TemporaryPass123" });
    expect(sessionStorage.getItem("tindahan.staff.access-token")).toBe("bootstrap-token");
  });

  it("creates a staff session and redirects to the workspace after a successful staff login", () => {
    mocks.initialized = true;
    render(<StaffLogin />);
    fireEvent.change(screen.getByPlaceholderText("you@store.com"), { target: { value: "manager@example.com" } });
    fireEvent.change(screen.getByPlaceholderText("••••••••"), { target: { value: "TemporaryPass123" } });
    fireEvent.click(screen.getByRole("button", { name: /sign in to workspace/i }));
    expect(mocks.loginMutate).toHaveBeenCalledWith({ identifier: "manager@example.com", password: "TemporaryPass123" });
    expect(mocks.setSession).toHaveBeenCalledWith(expect.objectContaining({ accessToken: "staff-token", user: expect.objectContaining({ role: "manager" }) }));
    expect(mocks.setLocation).toHaveBeenCalledWith("/");
  });

  it("completes the uninitialized owner bootstrap flow through simulated reload and resulting staff session", () => {
    mocks.ownerAuthenticated = true;
    const screenOne = render(<StaffLogin />);
    fireEvent.change(screen.getByPlaceholderText("Set 12+ character Admin password"), { target: { value: "TemporaryPass123" } });
    fireEvent.click(screen.getByRole("button", { name: "Initialize" }));
    expect(mocks.bootstrapMutate).toHaveBeenCalledWith({ password: "TemporaryPass123" });
    expect(sessionStorage.getItem("tindahan.staff.access-token")).toBe("bootstrap-token");

    mocks.ownerAuthenticated = false;
    mocks.initialized = true;
    screenOne.unmount();
    render(<StaffLogin />);
    expect(screen.getByText(/Admin account is already initialized/i)).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("you@store.com"), { target: { value: "manager@example.com" } });
    fireEvent.change(screen.getByPlaceholderText("••••••••"), { target: { value: "TemporaryPass123" } });
    fireEvent.click(screen.getByRole("button", { name: /sign in to workspace/i }));
    expect(mocks.setSession).toHaveBeenCalledWith(expect.objectContaining({ accessToken: "staff-token", user: expect.objectContaining({ role: "manager" }) }));
    expect(mocks.setLocation).toHaveBeenCalledWith("/");
  });
});
