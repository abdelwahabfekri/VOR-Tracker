import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  safelist: [
    "bg-appt", "bg-docs", "text-appt", "text-docs", "border-appt", "border-docs",
    "ring-appt/15", "ring-docs/15",
  ],
  theme: {
    extend: {
      colors: {
        // Aizer brand
        navy:   { DEFAULT: "#0F2A4A", 900: "#0B1F38", 700: "#1B3A5C", 600: "#24507A" },
        star:   { DEFAULT: "#2FA4E7", light: "#8FD0F2", 400: "#5BBDF0", 200: "#BFE4F7" },
        // Track colors (shipping theme)
        appt:   { DEFAULT: "#24507A", soft: "#E8F1F8" },   // Track 1 — patient/appointment (blue)
        docs:   { DEFAULT: "#2E7D5B", soft: "#E4EFEA" },   // Track 2 — documents (green)
        // Status semantics
        overdue:{ DEFAULT: "#C0392B", soft: "#FBEAE8" },
        soon:   { DEFAULT: "#B9770E", soft: "#FBF1E1" },
        done:   { DEFAULT: "#2E7D5B", soft: "#E4EFEA" },
        muted:  "#6B7684",
        line:   "#E3E8EF",
        ink:    "#182531",
        canvas: "#F6F8FB",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(16,42,74,0.04), 0 4px 16px rgba(16,42,74,0.06)",
        pop:  "0 8px 30px rgba(16,42,74,0.12)",
      },
      borderRadius: { xl2: "14px" },
    },
  },
  plugins: [],
};
export default config;
