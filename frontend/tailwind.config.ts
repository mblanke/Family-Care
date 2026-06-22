import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontSize: {
        // base 20px; large mode applied via the .text-large root class below
        base: ["1.25rem", { lineHeight: "1.6" }],   // 20px
        big: ["1.75rem", { lineHeight: "1.5" }],     // 28px
        huge: ["2.5rem", { lineHeight: "1.3" }],     // 40px (Today headings)
      },
      colors: {
        ink: "#111418",        // near-black text (AA on white)
        paper: "#ffffff",
        brand: "#0e7490",      // Brand/action color (buttons, nav) — distinct from the person colors; AA white text
        dad: "#1f6feb",        // Dad color token
        mom: "#a371f7",        // Mom color token
        confirm: "#1a7f37",    // success/confirmation (paired with icon+text, never alone)
      },
      minWidth: { touch: "60px" },
      minHeight: { touch: "60px" },
      spacing: { touch: "12px" },   // min gap between targets
    },
  },
  plugins: [],
} satisfies Config;
