import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "../api/client";

export interface User { id: number; username: string; display_name: string;
  role: "admin" | "family" | "parent"; font_scale: "normal" | "large"; person_id: number | null; }

interface AuthState { user: User | null; displayName: string; loading: boolean;
  login: (u: string, p: string) => Promise<void>; logout: () => Promise<void>; refresh: () => Promise<void>; }

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [displayName, setDisplayName] = useState("Home Board");
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      const me = await api.get<{ user: User; app_display_name: string }>("/api/auth/me");
      setUser(me.user); setDisplayName(me.app_display_name);
    } catch { setUser(null); } finally { setLoading(false); }
  }
  useEffect(() => { void refresh(); }, []);

  async function login(username: string, password: string) {
    await api.post("/api/auth/login", { username, password }); await refresh();
  }
  async function logout() { await api.post("/api/auth/logout"); setUser(null); }

  return <Ctx.Provider value={{ user, displayName, loading, login, logout, refresh }}>{children}</Ctx.Provider>;
}
export function useAuth() {
  const c = useContext(Ctx); if (!c) throw new Error("useAuth outside provider"); return c;
}
