import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    template: '%s - RUNE Tools',
    default: 'RUNE Tools',
  },
  description: "A suite of tools for RUNE",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // ... existing code ...
}