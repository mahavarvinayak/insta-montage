import "./globals.css";
import type { Metadata } from "next";
import { Shell } from "@/components/shell";
export const metadata: Metadata = { title: "Insta Montage", description: "Private Instagram scheduling dashboard", robots: { index: false } };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><head>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&display=swap" rel="stylesheet" />
    <style>{`:root{--font-sans:'Geist'}`}</style></head>
    <body><Shell>{children}</Shell></body></html>;
}
