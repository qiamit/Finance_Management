import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "./api";

export type Me = {
  user: { id: string; email: string; name: string };
  family: { id: string; name: string };
  role: string;
  geminiConfigured: boolean;
  casParserConfigured: boolean;
};

const Ctx = createContext<{
  me: Me | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
} | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      setMe(await api<Me>("/auth/me"));
    } catch {
      setMe(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function logout() {
    await api("/auth/logout", { method: "POST" });
    setMe(null);
  }

  return <Ctx.Provider value={{ me, loading, refresh, logout }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth outside provider");
  return ctx;
}
