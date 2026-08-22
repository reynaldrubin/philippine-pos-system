// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  accessToken: null as string | null,
  setSession: vi.fn(),
  clearSession: vi.fn(),
  setLocation: vi.fn(),
  loginMutate: vi.fn(),
  loading: false,
}));

vi.mock("@/stores/memberPortalStore", () => ({
  MEMBER_ACCESS_TOKEN_KEY: "tindahan.member.access-token",
  useMemberPortalStore: (selector: (state: { accessToken: string | null; setSession: typeof mocks.setSession; clearSession: typeof mocks.clearSession }) => unknown) => selector({ accessToken: mocks.accessToken, setSession: mocks.setSession, clearSession: mocks.clearSession }),
}));
vi.mock("wouter", () => ({
  useLocation: () => ["/portal", mocks.setLocation],
  Link: ({ children }: { children: React.ReactNode }) => <a href="/login">{children}</a>,
}));
vi.mock("qrcode.react", () => ({ QRCodeSVG: ({ value }: { value: string }) => <div data-testid="member-card-qr">{value}</div> }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    memberAuth: {
      login: { useMutation: (options: { onSuccess?: (session: any) => void }) => ({ isPending: false, error: null, mutate: (input: { identifier: string; password: string }) => { mocks.loginMutate(input); options.onSuccess?.({ accessToken: "member-token", member: { id: 9, firstName: "Maria", lastName: "Santos", memberNumber: "LM-0009" }, points: 24 }); } }) },
    },
    loyalty: {
      myPortalSummary: { useQuery: () => ({ isLoading: mocks.loading, error: null, data: { member: { id: 9, firstName: "Maria", lastName: "Santos", memberNumber: "LM-0009", createdAt: new Date("2026-01-01") }, account: { currentPoints: 24, lifetimeEarned: 30, lifetimeRedeemed: 6 } } }) },
      myPortalPurchases: { useQuery: () => ({ isLoading: mocks.loading, error: null, data: [{ id: 4, receiptNumber: "RCPT-9", createdAt: new Date("2026-02-01"), totalAmount: "500.00", pointsEarned: 5 }] }) },
      myPortalPoints: { useQuery: () => ({ isLoading: mocks.loading, error: null, data: [{ id: 3, type: "earn", points: 5, balanceAfter: 24, createdAt: new Date("2026-02-01"), note: "Completed sale" }] }) },
      myPortalCard: { useQuery: () => ({ isLoading: mocks.loading, error: null, data: { displayToken: "CARD-QR-0009", cardStatus: "active" } }) },
    },
  },
}));

import MemberPortal from "../client/src/pages/MemberPortal";

describe("member loyalty portal session flow", () => {
  beforeEach(() => {
    mocks.accessToken = null; mocks.loading = false; vi.clearAllMocks(); sessionStorage.clear();
  });
  afterEach(cleanup);

  it("submits a member login and establishes the isolated portal session", () => {
    render(<MemberPortal />);
    fireEvent.change(screen.getByPlaceholderText("0917 123 4567 or you@email.com"), { target: { value: "maria@example.com" } });
    fireEvent.change(screen.getByPlaceholderText("••••••••"), { target: { value: "MemberPass123" } });
    fireEvent.click(screen.getByRole("button", { name: /view my rewards/i }));
    expect(mocks.loginMutate).toHaveBeenCalledWith({ identifier: "maria@example.com", password: "MemberPass123" });
    expect(mocks.setSession).toHaveBeenCalledWith(expect.objectContaining({ accessToken: "member-token", points: 24 }));
    expect(mocks.setLocation).toHaveBeenCalledWith("/portal");
  });

  it("renders member rewards and clears the isolated token on sign out", () => {
    mocks.accessToken = "member-token";
    sessionStorage.setItem("tindahan.member.access-token", "member-token");
    render(<MemberPortal />);
    expect(screen.getByText("Hello, Maria.")).toBeInTheDocument();
    expect(screen.getByTestId("member-card-qr")).toHaveTextContent("CARD-QR-0009");
    fireEvent.click(screen.getByRole("button", { name: /sign out/i }));
    expect(mocks.clearSession).toHaveBeenCalledOnce();
    expect(sessionStorage.getItem("tindahan.member.access-token")).toBeNull();
    expect(mocks.setLocation).toHaveBeenCalledWith("/portal");
  });

  it("covers member login, dashboard loading, loaded rewards, and logout in a browser-like session sequence", () => {
    const loginScreen = render(<MemberPortal />);
    fireEvent.change(screen.getByPlaceholderText("0917 123 4567 or you@email.com"), { target: { value: "maria@example.com" } });
    fireEvent.change(screen.getByPlaceholderText("••••••••"), { target: { value: "MemberPass123" } });
    fireEvent.click(screen.getByRole("button", { name: /view my rewards/i }));
    expect(mocks.setSession).toHaveBeenCalledWith(expect.objectContaining({ accessToken: "member-token" }));

    mocks.accessToken = "member-token";
    mocks.loading = true;
    loginScreen.unmount();
    const loadingScreen = render(<MemberPortal />);
    expect(screen.getByText("Loading your rewards…")).toBeInTheDocument();

    mocks.loading = false;
    loadingScreen.unmount();
    render(<MemberPortal />);
    expect(screen.getByText("Hello, Maria.")).toBeInTheDocument();
    sessionStorage.setItem("tindahan.member.access-token", "member-token");
    fireEvent.click(screen.getByRole("button", { name: /sign out/i }));
    expect(mocks.clearSession).toHaveBeenCalledOnce();
    expect(sessionStorage.getItem("tindahan.member.access-token")).toBeNull();
    expect(mocks.setLocation).toHaveBeenCalledWith("/portal");
  });
});
