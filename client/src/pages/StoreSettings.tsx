import { trpc } from "@/lib/trpc";
import { usePosStore } from "@/stores/posStore";
import { Check, Coffee, Cpu, ScanLine, ShoppingBasket } from "lucide-react";
import React from "react";

const modes = [
  { value: "cafe" as const, label: "Cafe / Food & Beverage", description: "Category tabs, modifier-ready product tiles, and table/order context.", icon: Coffee, accent: "bg-[#fff1df] text-[#a65c2b]" },
  { value: "hardware" as const, label: "Hardware", description: "Dense SKU-first rows with unit, stock, and price details for fast counter sales.", icon: Cpu, accent: "bg-[#e8eef9] text-[#45618e]" },
  { value: "grocery" as const, label: "Grocery / Supermarket", description: "Scanner-first flow with quick-key space and a high-visibility running tally.", icon: ScanLine, accent: "bg-[#e1f7ef] text-[#187b6c]" },
  { value: "retail" as const, label: "Standard Retail", description: "Balanced product cards with stock badges, search, and collection-style filtering.", icon: ShoppingBasket, accent: "bg-[#e9f5d8] text-[#4e7134]" },
];

export default function StoreSettings() {
  const { user } = usePosStore();
  const setting = trpc.settings.posDisplay.get.useQuery(undefined, { enabled: Boolean(user), retry: false });
  const update = trpc.settings.posDisplay.update.useMutation({ onSuccess: () => setting.refetch() });
  if (user?.role !== "admin") return <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">Only Admin accounts can change Store Settings.</div>;
  return <div className="space-y-6"><header><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#738278]">Store Settings</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#17352e]">POS Register Display</h1><p className="mt-2 max-w-2xl text-sm text-[#74827b]">Choose the interaction pattern that best fits your Philippine retail operation. The selected mode is shared by all registers.</p></header><section className="rounded-2xl border border-[#dce3db] bg-white p-6"><div className="grid gap-4 md:grid-cols-2">{modes.map(mode => { const Icon = mode.icon; const selected = (setting.data ?? "retail") === mode.value; return <button key={mode.value} type="button" onClick={() => update.mutate({ mode: mode.value })} disabled={update.isPending} className={`relative rounded-2xl border p-5 text-left transition ${selected ? "border-[#147d78] bg-[#f0fbf7] shadow-[0_12px_30px_-20px_rgba(20,125,120,0.7)]" : "border-[#e0e8e3] hover:border-[#9bc9bf]"}`}><div className="flex items-start justify-between gap-4"><span className={`grid h-11 w-11 place-items-center rounded-xl ${mode.accent}`}><Icon className="h-5 w-5" /></span>{selected && <span className="inline-flex items-center gap-1 rounded-full bg-[#147d78] px-2.5 py-1 text-[11px] font-bold text-white"><Check className="h-3 w-3" />Active</span>}</div><h2 className="mt-5 font-semibold text-[#21463e]">{mode.label}</h2><p className="mt-2 text-sm leading-6 text-[#718981]">{mode.description}</p></button> })}</div><div className="mt-6 rounded-xl bg-[#f5faf7] p-4 text-xs leading-5 text-[#68837c]">Layout mode changes are immediately available on the next Register render. Product modifiers, merchant QR assets, and payment references remain transaction-level controls and are preserved across modes.</div></section></div>;
}
