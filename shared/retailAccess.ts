export const RETAIL_MENU_KEYS = ["overview", "register", "inventory", "transfers", "members", "operations", "reports", "users", "compliance", "hris", "timekeeping"] as const;
export type RetailMenuKey = (typeof RETAIL_MENU_KEYS)[number];
export type RetailStaffRole = "cashier" | "manager" | "admin";

export const PHILIPPINE_RETAIL_JOB_TITLES = [
  { value: "Head Office Owner", role: "admin" as const },
  { value: "Operations Manager", role: "admin" as const },
  { value: "Area Manager", role: "manager" as const },
  { value: "Branch Manager", role: "manager" as const },
  { value: "Store Manager", role: "manager" as const },
  { value: "Store Supervisor", role: "manager" as const },
  { value: "Cashier", role: "cashier" as const },
  { value: "Sales Associate", role: "cashier" as const },
] as const;

export const DEFAULT_MENU_ACCESS: Record<RetailStaffRole, RetailMenuKey[]> = {
  cashier: ["overview", "register", "members", "timekeeping"],
  manager: ["overview", "register", "inventory", "transfers", "members", "operations", "reports", "hris", "timekeeping"],
  admin: [...RETAIL_MENU_KEYS],
};

export function defaultJobTitleForRole(role: RetailStaffRole) {
  return role === "admin" ? "Head Office Owner" : role === "manager" ? "Store Manager" : "Cashier";
}

export function roleForJobTitle(jobTitle: string): RetailStaffRole | undefined {
  return PHILIPPINE_RETAIL_JOB_TITLES.find(title => title.value === jobTitle)?.role;
}
