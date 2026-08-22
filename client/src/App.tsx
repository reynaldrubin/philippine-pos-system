import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import StaffShell from "@/components/StaffShell";
import { usePosStore } from "@/stores/posStore";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Inventory from "./pages/Inventory";
import Members from "./pages/Members";
import Operations from "./pages/Operations";
import Overview from "./pages/Overview";
import Register from "./pages/Register";
import StaffLogin from "./pages/StaffLogin";
import Transfers from "./pages/Transfers";

function Protected({ children }: { children: React.ReactNode }) {
  const accessToken = usePosStore(state => state.accessToken);
  if (!accessToken) return <StaffLogin />;
  return <StaffShell>{children}</StaffShell>;
}

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/login"} component={StaffLogin} />
      <Route path={"/"}><Protected><Overview /></Protected></Route>
      <Route path={"/register"}><Protected><Register /></Protected></Route>
      <Route path={"/inventory"}><Protected><Inventory /></Protected></Route>
      <Route path={"/transfers"}><Protected><Transfers /></Protected></Route>
      <Route path={"/members"}><Protected><Members /></Protected></Route>
      <Route path={"/operations"}><Protected><Operations /></Protected></Route>
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
