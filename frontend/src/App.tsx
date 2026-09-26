// App.tsx
import { AuthProvider, useAuth } from "./lib/auth";
import { Login } from "./screens/Login";
import { AppShell } from "./AppShell";
function Gate() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="ground min-h-screen flex items-center justify-center">
        <p className="text-big text-ink-soft">Loading…</p>
      </div>
    );
  }
  return user ? <AppShell /> : <Login />;
}
export function App() { return <AuthProvider><Gate /></AuthProvider>; }
