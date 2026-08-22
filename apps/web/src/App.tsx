import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth";
import { AppShell } from "./layout/AppShell";
import { InvitePage, LoginPage, SignupPage } from "./pages/AuthPages";
import { DashboardPage } from "./pages/DashboardPage";
import { MembersPage } from "./pages/MembersPage";
import { MemberDetailPage } from "./pages/MemberDetailPage";
import { HoldingsPage } from "./pages/HoldingsPage";
import { HoldingFormPage } from "./pages/HoldingFormPage";
import { PlansPage } from "./pages/PlansPage";
import { ImportPage, ImportReviewPage } from "./pages/ImportPage";
import { InsightsPage } from "./pages/InsightsPage";
import { SettingsPage } from "./pages/SettingsPage";

function Guard({ children }: { children: React.ReactNode }) {
  const { me, loading } = useAuth();
  if (loading) return <div className="p-10 text-slate-400">Loading…</div>;
  if (!me) return <Navigate to="/login" replace />;
  return children;
}

function Guest({ children }: { children: React.ReactNode }) {
  const { me, loading } = useAuth();
  if (loading) return <div className="p-10 text-slate-400">Loading…</div>;
  if (me) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <Guest>
            <LoginPage />
          </Guest>
        }
      />
      <Route
        path="/signup"
        element={
          <Guest>
            <SignupPage />
          </Guest>
        }
      />
      <Route path="/invite/:token" element={<InvitePage />} />
      <Route
        element={
          <Guard>
            <AppShell />
          </Guard>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/members" element={<MembersPage />} />
        <Route path="/members/:id" element={<MemberDetailPage />} />
        <Route path="/holdings" element={<HoldingsPage />} />
        <Route path="/holdings/new" element={<HoldingFormPage />} />
        <Route path="/holdings/:id/edit" element={<HoldingFormPage />} />
        <Route path="/plans" element={<PlansPage />} />
        <Route path="/import" element={<ImportPage />} />
        <Route path="/import/:id" element={<ImportReviewPage />} />
        <Route path="/insights" element={<InsightsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}
