// AppShell.tsx — platinum ground, glass header, then the role's layout
import { useAuth } from "./lib/auth";
import { useFontScale } from "./lib/fontScale";
import { AppHeader } from "./components/AppHeader";
import { ParentLayout } from "./parent/ParentLayout";
import { AdminLayout } from "./admin/AdminLayout";
export function AppShell() {
  const { user, displayName, logout } = useAuth();
  const { scale, toggle } = useFontScale();
  return (
    <div className="ground min-h-screen">
      <div className="max-w-6xl mx-auto px-4 sm:px-8 pt-5 pb-12 flex flex-col gap-5">
        <AppHeader title={displayName} scale={scale} onToggleScale={toggle} onLogout={logout} />
        {user?.role === "parent" ? <ParentLayout /> : <AdminLayout />}
      </div>
    </div>
  );
}
