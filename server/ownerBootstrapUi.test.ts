import { describe, expect, it } from "vitest";
import { getOwnerBootstrapUiState } from "../client/src/lib/ownerBootstrapUi";

describe("owner bootstrap login interface state", () => {
  it("shows a checking state while bootstrap readiness is loading", () => {
    expect(getOwnerBootstrapUiState({ isLoading: true, initialized: undefined, isOwnerAuthenticated: false })).toBe("checking");
  });

  it("hides the repeated owner sign-in action after an Admin is initialized", () => {
    expect(getOwnerBootstrapUiState({ isLoading: false, initialized: true, isOwnerAuthenticated: false })).toBe("initialized");
  });

  it("shows the password initializer only for an authenticated owner while no Admin exists", () => {
    expect(getOwnerBootstrapUiState({ isLoading: false, initialized: false, isOwnerAuthenticated: true })).toBe("set-admin-password");
  });

  it("shows the owner sign-in action only for the uninitialized unauthenticated path", () => {
    expect(getOwnerBootstrapUiState({ isLoading: false, initialized: false, isOwnerAuthenticated: false })).toBe("sign-in-owner");
  });
});
