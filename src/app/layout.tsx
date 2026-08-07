import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Referral Tracker — Aizer Vision",
  description: "Vision Department referral tracking. Operational data only — no patient identifiers.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
