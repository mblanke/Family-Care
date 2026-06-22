// App.tsx
import { AuthProvider, useAuth } from "./lib/auth";
import { Login } from "./screens/Login";
import { AppShell } from "./AppShell";
function Gate() {
  const { user, loading } = useAuth();
  if (loading) return <p className="p-6 text-big">Loading…</p>;
  return user ? <AppShell /> : <Login />;
}
export function App() { return <AuthProvider><Gate /></AuthProvider>; }
