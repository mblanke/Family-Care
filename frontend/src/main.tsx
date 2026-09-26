import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// Self-hosted fonts: the iPads reach this app over Tailscale only, so no Google Fonts dependency.
import "@fontsource/atkinson-hyperlegible/400.css";
import "@fontsource/atkinson-hyperlegible/700.css";
import "@fontsource/sora/600.css";
import "@fontsource/sora/700.css";
import "./index.css";
import { App } from "./App";
createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
