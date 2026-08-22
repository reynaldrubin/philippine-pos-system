export type OwnerBootstrapUiState = "checking" | "initialized" | "set-admin-password" | "sign-in-owner";

export function getOwnerBootstrapUiState(input: { isLoading: boolean; initialized: boolean | undefined; isOwnerAuthenticated: boolean }): OwnerBootstrapUiState {
  if (input.isLoading) return "checking";
  if (input.initialized) return "initialized";
  return input.isOwnerAuthenticated ? "set-admin-password" : "sign-in-owner";
}
