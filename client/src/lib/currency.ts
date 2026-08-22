export const formatPHP = (amount: string | number) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(Number(amount));

export const formatRole = (role?: string | null) => role ? `${role.charAt(0).toUpperCase()}${role.slice(1)}` : "Staff";
