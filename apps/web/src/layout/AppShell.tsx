import { NavLink, Outlet } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Wallet,
  Repeat,
  Upload,
  Sparkles,
  Settings,
  LogOut,
} from "lucide-react";
import { useAuth } from "../auth";

const links = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/members", label: "Members", icon: Users },
  { to: "/holdings", label: "Holdings", icon: Wallet },
  { to: "/plans", label: "SIPs & RDs", icon: Repeat },
  { to: "/import", label: "Import", icon: Upload },
  { to: "/insights", label: "AI Insights", icon: Sparkles },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function AppShell() {
  const { me, logout } = useAuth();
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="border-b border-white/10 bg-ink-900/80 px-4 py-5 lg:border-b-0 lg:border-r">
        <div className="font-serif text-2xl text-gold-400">Ledger</div>
        <p className="mt-1 text-xs text-slate-400">{me?.family.name}</p>
        <nav className="mt-6 grid grid-cols-2 gap-1 lg:grid-cols-1">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                  isActive ? "bg-white/10 text-gold-400" : "text-slate-300 hover:bg-white/5"
                }`
              }
            >
              <link.icon size={16} />
              {link.label}
            </NavLink>
          ))}
        </nav>
        <button
          className="mt-6 flex items-center gap-2 px-3 text-sm text-slate-400 hover:text-slate-100"
          onClick={() => void logout()}
        >
          <LogOut size={16} /> Sign out
        </button>
      </aside>
      <main className="px-4 py-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}
