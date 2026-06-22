// AppShell.tsx — choose layout by role
import { useAuth } from "./lib/auth";
import { useFontScale } from "./lib/fontScale";
import { Button } from "./components/Button";
import { ParentLayout } from "./parent/ParentLayout";
import { AdminLayout } from "./admin/AdminLayout";
export function AppShell() {
  const { user, displayName, logout } = useAuth();
  const { scale, toggle } = useFontScale();
  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between p-4 border-b-4">
        <h1 className="text-big font-bold">{displayName}</h1>
        <div className="flex gap-touch">
          <Button onClick={toggle}>{scale === "large" ? "Aa Normal" : "Aa Larger"}</Button>
          <Button onClick={logout}>Sign out</Button>
        </div>
      </header>
      {user?.role === "parent" ? <ParentLayout /> : <AdminLayout />}
    </div>
  );
}
