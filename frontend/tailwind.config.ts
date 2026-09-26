import type { Config } from "tailwindcss";

// Liquid-metal, senior-first token set.
// Rules that still hold: big text, >=64px targets, text + icon (never colour alone),
// person colour always beside the person's name.
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Atkinson Hyperlegible"', "system-ui", "sans-serif"],
        display: ["Sora", '"Atkinson Hyperlegible"', "system-ui", "sans-serif"],
      },
      fontSize: {
        // root 16px; Larger-text mode bumps the root to 22.5px (see index.css)
        base: ["1.375rem", { lineHeight: "1.5" }],   // 22px
        big: ["1.875rem", { lineHeight: "1.4" }],    // 30px
        title: ["2rem", { lineHeight: "1.3" }],      // 32px
        huge: ["3rem", { lineHeight: "1.2" }],       // 48px
      },
      colors: {
        ink: "#0f1720",          // text, 16:1 on glass
        "ink-soft": "#3b4652",   // secondary text, 8:1 on glass
        paper: "#ffffff",
        ground: "#e6e9ee",       // flat fallback for the platinum ground
        brand: { DEFAULT: "#0e7490", light: "#0f7f9d", dark: "#0a5570", edge: "#084b5e" },
        confirm: { DEFAULT: "#1a7f37", light: "#22883f", dark: "#145f2a", edge: "#0f4f22" },
        danger: { DEFAULT: "#b3261e", light: "#c4362c", dark: "#8d1d17", edge: "#6e1511" },
        dad: "#1f6feb",
        mom: "#8a5cf0",
      },
      borderRadius: { pill: "999px", card: "28px", square: "20px" },
      minWidth: { touch: "64px" },
      minHeight: { touch: "64px" },
      spacing: { touch: "12px" },   // min gap between targets
      boxShadow: {
        lift: "inset 0 1px 0 rgba(255,255,255,.95), 0 14px 34px rgba(15,23,32,.10)",
        chrome: "inset 0 1px 0 rgba(255,255,255,.95), inset 0 -1px 0 rgba(15,23,32,.10), 0 4px 12px rgba(15,23,32,.10)",
        dialog: "inset 0 1px 0 rgba(255,255,255,1), 0 40px 90px rgba(15,23,32,.35)",
      },
    },
  },
  plugins: [],
} satisfies Config;
