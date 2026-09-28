import type { Config } from "tailwindcss";

// Design tokens. Colors keep the Aizer palette and its meanings; everything
// visual (gradients, glows, shadows, radius, motion) is defined here once so
// components never build class names at runtime (Tailwind can't see those).
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Aizer brand
        navy:   { DEFAULT: "#0F2A4A", 900: "#0B1F38", 700: "#1B3A5C", 600: "#24507A" },
        star:   { DEFAULT: "#2FA4E7", light: "#8FD0F2", 400: "#5BBDF0", 200: "#BFE4F7" },
        // Track colors
        appt:   { DEFAULT: "#24507A", soft: "#E8F1F8" },   // Track 1 — appointment (blue)
        docs:   { DEFAULT: "#2E7D5B", soft: "#E4EFEA" },   // Track 2 — records (green)
        // Status semantics
        overdue:{ DEFAULT: "#C0392B", soft: "#FBEAE8" },
        soon:   { DEFAULT: "#B9770E", soft: "#FBF1E1" },
        done:   { DEFAULT: "#2E7D5B", soft: "#E4EFEA" },
        muted:  "#6B7684",
        line:   "#E3E8EF",
        ink:    "#182531",
        canvas: "#F6F8FB",
        // Neutral for admin/system events (corrections, edits) — no new hue.
        slate:  { DEFAULT: "#4A5563", soft: "#EEF1F5" },
      },
      fontFamily: {
        sans: ["var(--font-poppins)", "ui-sans-serif", "system-ui", "sans-serif"],
        // Poppins (as served by Google Fonts) has no tabular figures, so
        // identifiers and number columns use a monospace face instead.
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      fontSize: {
        "2xs": ["11px", "16px"],
      },
      borderRadius: {
        xl2: "18px",   // cards, table containers
        ctl: "11px",   // inputs, buttons
        modal: "22px",
      },
      boxShadow: {
        // three elevation levels only
        surface: "0 1px 2px rgba(16,42,74,0.04), 0 2px 10px rgba(16,42,74,0.05)",
        lifted:  "0 2px 4px rgba(16,42,74,0.05), 0 10px 28px rgba(16,42,74,0.10)",
        overlay: "0 24px 64px rgba(11,31,56,0.22), 0 4px 12px rgba(11,31,56,0.08)",
        // glows — used for focus / current / success only
        "glow-star":    "0 0 0 4px rgba(47,164,231,0.16), 0 0 18px rgba(47,164,231,0.22)",
        "glow-appt":    "0 0 0 4px rgba(36,80,122,0.14), 0 0 20px rgba(47,164,231,0.30)",
        "glow-docs":    "0 0 0 4px rgba(46,125,91,0.14), 0 0 20px rgba(46,125,91,0.28)",
        "glow-overdue": "0 0 0 3px rgba(192,57,43,0.12), 0 0 10px rgba(192,57,43,0.20)",
        "glow-btn":     "0 6px 18px rgba(47,164,231,0.30)",
        // legacy aliases
        card: "0 1px 2px rgba(16,42,74,0.04), 0 2px 10px rgba(16,42,74,0.05)",
        pop:  "0 24px 64px rgba(11,31,56,0.22), 0 4px 12px rgba(11,31,56,0.08)",
      },
      backgroundImage: {
        "nav":        "linear-gradient(100deg, #0B1F38 0%, #0F2A4A 55%, #1B3A5C 100%)",
        "nav-glow":   "radial-gradient(420px 120px at 12% 0%, rgba(47,164,231,0.22), transparent 70%)",
        "login":      "radial-gradient(700px 420px at 50% -8%, rgba(47,164,231,0.28), transparent 70%), linear-gradient(160deg, #0B1F38 0%, #0F2A4A 60%, #1B3A5C 100%)",
        "primary":    "linear-gradient(180deg, #16365C 0%, #0F2A4A 100%)",
        "star-btn":   "linear-gradient(180deg, #6CC6F3 0%, #4DB5EC 100%)",
        "surface-appt":    "linear-gradient(135deg, #FFFFFF 0%, #FFFFFF 40%, #EEF5FB 100%)",
        "surface-docs":    "linear-gradient(135deg, #FFFFFF 0%, #FFFFFF 40%, #EDF5F0 100%)",
        "surface-overdue": "linear-gradient(135deg, #FFFFFF 0%, #FFFFFF 45%, #FDF1EF 100%)",
        "surface-soon":    "linear-gradient(135deg, #FFFFFF 0%, #FFFFFF 45%, #FCF5EA 100%)",
        "surface-done":    "linear-gradient(135deg, #FFFFFF 0%, #FFFFFF 40%, #EDF5F0 100%)",
        "surface-neutral": "linear-gradient(180deg, #FFFFFF 0%, #FAFBFD 100%)",
        "table-head":      "linear-gradient(180deg, #F9FBFD 0%, #F2F5F9 100%)",
        "row-hover":       "linear-gradient(90deg, rgba(47,164,231,0.07) 0%, rgba(47,164,231,0.02) 100%)",
        "handoff":         "linear-gradient(90deg, #E8F1F8 0%, #E4EFEA 100%)",
        "track-appt":      "linear-gradient(135deg, #2E6394 0%, #24507A 100%)",
        "track-docs":      "linear-gradient(135deg, #37936B 0%, #2E7D5B 100%)",
      },
      transitionDuration: { fast: "160ms", press: "120ms", enter: "240ms", dialog: "260ms", milestone: "450ms" },
      transitionTimingFunction: {
        out: "cubic-bezier(0.22, 1, 0.36, 1)",
        in: "cubic-bezier(0.55, 0, 1, 0.45)",
        spring: "cubic-bezier(0.34, 1.36, 0.64, 1)",
      },
      keyframes: {
        "fade-up":   { from: { opacity: "0", transform: "translateY(6px)" }, to: { opacity: "1", transform: "none" } },
        "fade-in":   { from: { opacity: "0" }, to: { opacity: "1" } },
        "chip-in":   { from: { opacity: "0", transform: "scale(0.94)" }, to: { opacity: "1", transform: "none" } },
        "pulse-once":{ "0%": { boxShadow: "0 0 0 0 var(--pulse, rgba(47,164,231,0.45))" }, "100%": { boxShadow: "0 0 0 14px rgba(47,164,231,0)" } },
        "check-pop": { "0%": { transform: "scale(0.4)", opacity: "0" }, "60%": { transform: "scale(1.12)", opacity: "1" }, "100%": { transform: "scale(1)" } },
        "burst":     { "0%": { transform: "scale(0.6)", opacity: "0.7" }, "100%": { transform: "scale(1.9)", opacity: "0" } },
        "fill-x":    { from: { transform: "scaleX(0)" }, to: { transform: "scaleX(1)" } },
        "fill-y":    { from: { transform: "scaleY(0)" }, to: { transform: "scaleY(1)" } },
        "shimmer":   { from: { backgroundPosition: "-400px 0" }, to: { backgroundPosition: "400px 0" } },
        "flash-ok":  { "0%": { boxShadow: "0 0 0 0 rgba(46,125,91,0.45)", backgroundColor: "#E4EFEA" }, "100%": { boxShadow: "0 0 0 8px rgba(46,125,91,0)", backgroundColor: "transparent" } },
        "toast-in":  { from: { opacity: "0", transform: "translateY(10px) scale(0.98)" }, to: { opacity: "1", transform: "none" } },
        "dialog-in": { from: { opacity: "0", transform: "translateY(8px) scale(0.98)" }, to: { opacity: "1", transform: "none" } },
        "drawer-in": { from: { opacity: "0", transform: "translateX(24px)" }, to: { opacity: "1", transform: "none" } },
      },
      animation: {
        "fade-up":   "fade-up 240ms cubic-bezier(0.22,1,0.36,1) both",
        "fade-in":   "fade-in 200ms cubic-bezier(0.22,1,0.36,1) both",
        "chip-in":   "chip-in 180ms cubic-bezier(0.22,1,0.36,1) both",
        "pulse-once":"pulse-once 900ms cubic-bezier(0.22,1,0.36,1) 1",
        "check-pop": "check-pop 420ms cubic-bezier(0.34,1.36,0.64,1) both",
        "burst":     "burst 500ms cubic-bezier(0.22,1,0.36,1) both",
        "fill-x":    "fill-x 450ms cubic-bezier(0.22,1,0.36,1) both",
        "fill-y":    "fill-y 450ms cubic-bezier(0.22,1,0.36,1) both",
        "shimmer":   "shimmer 1.4s linear infinite",
        "flash-ok":  "flash-ok 700ms ease-out",
        "toast-in":  "toast-in 240ms cubic-bezier(0.22,1,0.36,1) both",
        "dialog-in": "dialog-in 260ms cubic-bezier(0.22,1,0.36,1) both",
        "drawer-in": "drawer-in 280ms cubic-bezier(0.22,1,0.36,1) both",
      },
    },
  },
  plugins: [],
};
export default config;
