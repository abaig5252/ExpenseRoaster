import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/Landing";
import LocalAuth from "@/pages/LocalAuth";
import ResetPassword from "@/pages/ResetPassword";
import Upload from "@/pages/Upload";
import BankStatement from "@/pages/BankStatement";
import MonthlyTracker from "@/pages/MonthlyTracker";
import Pricing from "@/pages/Pricing";
import AnnualReport from "@/pages/AnnualReport";
import UpgradeSuccess from "@/pages/UpgradeSuccess";
import Install from "@/pages/Install";
import Contact from "@/pages/Contact";
import RefundPolicy from "@/pages/RefundPolicy";
import PrivacyPolicy from "@/pages/PrivacyPolicy";
import TermsOfService from "@/pages/TermsOfService";
import DataDeletion from "@/pages/DataDeletion";
import VerifyEmail from "@/pages/VerifyEmail";
import Onboarding from "@/pages/Onboarding";
import { useAuth } from "@/hooks/use-auth";
import { useMe } from "@/hooks/use-subscription";
import { MobileTabBar } from "@/components/MobileTabBar";

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, isLoading } = useAuth();
  const { data: me, isLoading: meLoading } = useMe();

  if (isLoading || meLoading) {
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
    return <Redirect to="/login" />;
  }

  if (me && me.emailVerified === false) {
    return <Redirect to="/verify" />;
  }

  if (me && me.onboardingComplete === false) {
    return <Redirect to="/onboarding" />;
  }

  return <Component />;
}

function OnboardingRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  const { data: me, isLoading: meLoading } = useMe();

  if (isLoading || meLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-[hsl(var(--primary))]/20 border-t-[hsl(var(--primary))] animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  if (me && me.emailVerified === false) {
    return <Redirect to="/verify" />;
  }

  if (me && me.onboardingComplete === true) {
    return <Redirect to="/upload" />;
  }

  return <Onboarding />;
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
      <Route path="/login" component={LocalAuth} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/verify" component={VerifyEmail} />
      <Route path="/onboarding" component={OnboardingRoute} />
      <Route path="/upload" component={() => <ProtectedRoute component={Upload} />} />
      <Route path="/bank" component={() => <ProtectedRoute component={BankStatement} />} />
      <Route path="/tracker" component={() => <ProtectedRoute component={MonthlyTracker} />} />
      <Route path="/pricing" component={() => <ProtectedRoute component={Pricing} />} />
      <Route path="/annual-report" component={() => <ProtectedRoute component={AnnualReport} />} />
      <Route path="/upgrade/success" component={() => <ProtectedRoute component={UpgradeSuccess} />} />
      <Route path="/install" component={Install} />
      <Route path="/contact" component={Contact} />
      <Route path="/refund-policy" component={RefundPolicy} />
      <Route path="/privacy-policy" component={PrivacyPolicy} />
      <Route path="/terms-of-service" component={TermsOfService} />
      <Route path="/data-deletion" component={DataDeletion} />
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
