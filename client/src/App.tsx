import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import StaffShell from "@/components/StaffShell";
import { usePosStore } from "@/stores/posStore";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import { lazy, Suspense } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import StaffLogin from "./pages/StaffLogin";

const Inventory = lazy(() => import("./pages/Inventory"));
const Members = lazy(() => import("./pages/Members"));
const MemberPortal = lazy(() => import("./pages/MemberPortal"));
const Operations = lazy(() => import("./pages/Operations"));
const Overview = lazy(() => import("./pages/Overview"));
const Register = lazy(() => import("./pages/Register"));
const Reports = lazy(() => import("./pages/Reports"));
const Transfers = lazy(() => import("./pages/Transfers"));
const PurchaseRequests = lazy(() => import("./pages/PurchaseRequests"));
const PurchaseOrders = lazy(() => import("./pages/PurchaseOrders"));
const Users = lazy(() => import("./pages/Users"));
const Compliance = lazy(() => import("./pages/Compliance"));
const CashControls = lazy(() => import("./pages/CashControls"));
const CashClose = lazy(() => import("./pages/CashClose"));
const Returns = lazy(() => import("./pages/Returns"));
const StoreSettings = lazy(() => import("./pages/StoreSettings"));

function Protected({ children }: { children: React.ReactNode }) {
  const accessToken = usePosStore(state => state.accessToken);
  if (!accessToken) return <StaffLogin />;
  return <StaffShell><Suspense fallback={<RouteLoading />}>{children}</Suspense></StaffShell>;
}

function RouteLoading() {
  return <div className="grid min-h-72 place-items-center rounded-2xl border border-[#dce3db] bg-white text-sm text-[#74827b]"><div className="text-center"><span className="mx-auto block h-8 w-8 animate-spin rounded-full border-2 border-[#d9f99d] border-t-[#17352e]" /><p className="mt-3">Loading workspace…</p></div></div>;
}

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/login"} component={StaffLogin} />
      <Route path={"/portal"}><Suspense fallback={<RouteLoading />}><MemberPortal /></Suspense></Route>
      <Route path={"/"}><Protected><Overview /></Protected></Route>
      <Route path={"/register"}><Protected><Register /></Protected></Route>
      <Route path={"/inventory"}><Protected><Inventory /></Protected></Route>
      <Route path={"/transfers"}><Protected><Transfers /></Protected></Route>
      <Route path={"/purchase-requests"}><Protected><PurchaseRequests /></Protected></Route>
      <Route path={"/purchase-orders"}><Protected><PurchaseOrders /></Protected></Route>
      <Route path={"/members"}><Protected><Members /></Protected></Route>
      <Route path={"/operations"}><Protected><Operations /></Protected></Route>
      <Route path={"/reports"}><Protected><Reports /></Protected></Route>
      <Route path={"/users"}><Protected><Users /></Protected></Route>
      <Route path={"/compliance"}><Protected><Compliance /></Protected></Route>
      <Route path={"/cash-controls"}><Protected><CashControls /></Protected></Route>
      <Route path={"/cash-close"}><Protected><CashClose /></Protected></Route>
      <Route path={"/returns"}><Protected><Returns /></Protected></Route>
      <Route path={"/store-settings"}><Protected><StoreSettings /></Protected></Route>
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
