import { useEffect } from "react";
import { api } from "../api/client";
import { useAuth } from "./auth";

export function useFontScale() {
  const { user, refresh } = useAuth();
  const scale = user?.font_scale ?? "normal";
  useEffect(() => {
    document.documentElement.classList.toggle("text-large", scale === "large");
  }, [scale]);
  async function toggle() {
    const next = scale === "large" ? "normal" : "large";
    await api.put("/api/auth/me/font-scale", { font_scale: next });
    await refresh();
  }
  return { scale, toggle };
}
