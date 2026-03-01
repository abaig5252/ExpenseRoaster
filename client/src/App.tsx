import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/Landing";
import Upload from "@/pages/Upload";
import BankStatement from "@/pages/BankStatement";
import MonthlyTracker from "@/pages/MonthlyTracker";
import Pricing from "@/pages/Pricing";
import AnnualReport from "@/pages/AnnualReport";
import UpgradeSuccess from "@/pages/UpgradeSuccess";
import { useAuth } from "@/hooks/use-auth";
import { MobileTabBar } from "@/components/MobileTabBar";
import { InstallPrompt } from "@/components/InstallPrompt";

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-[hsl(var(--primary))]/20 border-t-[hsl(var(--primary))] animate-spin" />
          <p className="text-muted-foreground text-sm">Loading your financial shame...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    window.location.href = "/api/login";
    return null;
  }

  return <Component />;
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <Switch>
      <Route path="/" component={() => {
        if (isLoading) return (
          <div className="min-h-screen flex items-center justify-center">
            <div className="w-10 h-10 rounded-full border-4 border-[hsl(var(--primary))]/20 border-t-[hsl(var(--primary))] animate-spin" />
          </div>
        );
        return isAuthenticated ? <Redirect to="/upload" /> : <Landing />;
      }} />
      <Route path="/upload" component={() => <ProtectedRoute component={Upload} />} />
      <Route path="/bank" component={() => <ProtectedRoute component={BankStatement} />} />
      <Route path="/tracker" component={() => <ProtectedRoute component={MonthlyTracker} />} />
      <Route path="/pricing" component={() => <ProtectedRoute component={Pricing} />} />
      <Route path="/annual-report" component={() => <ProtectedRoute component={AnnualReport} />} />
      <Route path="/upgrade/success" component={() => <ProtectedRoute component={UpgradeSuccess} />} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppShell() {
  const { isAuthenticated } = useAuth();
  return (
    <>
      <Router />
      {isAuthenticated && <MobileTabBar />}
      {isAuthenticated && <InstallPrompt />}
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <AppShell />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
