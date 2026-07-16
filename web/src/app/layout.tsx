import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: {
    default: "Aegis — Decentralized Escrow Marketplace",
    template: "%s · Aegis",
  },
  description:
    "Trustless, milestone-based escrow for two-sided marketplaces on Stellar. Lock funds, deliver work, release on your terms — with on-chain reputation and arbiter-backed dispute resolution.",
  applicationName: "Aegis",
  keywords: ["Stellar", "Soroban", "escrow", "marketplace", "web3", "smart contracts"],
  authors: [{ name: "Aegis Labs" }],
  openGraph: {
    title: "Aegis — Decentralized Escrow Marketplace",
    description: "Trustless, milestone-based escrow on Stellar.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f0d0b" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans`} suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
