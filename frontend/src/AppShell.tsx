// AppShell.tsx — authed chrome: display name, font toggle, logout. (Screens land in Plan 01.)
import { useAuth } from "./lib/auth";
import { useFontScale } from "./lib/fontScale";
import { Button } from "./components/Button";
export function AppShell() {
  const { user, displayName, logout } = useAuth();
  const { scale, toggle } = useFontScale();
  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between p-4 border-b-4">
        <h1 className="text-big font-bold">{displayName}</h1>
        <div className="flex gap-touch">
          <Button onClick={toggle}>{scale === "large" ? "Aa Normal" : "Aa Larger"}</Button>
          <Button onClick={logout}>Sign out ({user?.display_name})</Button>
        </div>
      </header>
      <main className="p-6 text-huge">Welcome — screens arrive in v1 core.</main>
    </div>
  );
}
