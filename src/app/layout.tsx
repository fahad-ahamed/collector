import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#075E54",
};

export const metadata: Metadata = {
  title: "Collector - Access Control Panel",
  description: "Collector - Full access control panel for contacts & files. View, download, and manage all your phone data from anywhere.",
  keywords: ["Collector", "contacts", "files", "phone manager", "access control"],
  authors: [{ name: "Collector" }],
  openGraph: {
    title: "Collector - Access Control Panel",
    description: "Full access control panel for contacts & files from your phone",
    type: "website",
    siteName: "Collector",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
