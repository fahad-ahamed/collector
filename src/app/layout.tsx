import type { Metadata } from "next";
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

export const metadata: Metadata = {
  title: "Contact Collector - Collect & Manage Contacts in vCard Format",
  description: "Collect contact numbers from your mobile device and manage them in vCard format. View, copy, and download all your contacts easily.",
  keywords: ["Contact Collector", "vCard", "contacts", "phone numbers", "contact manager"],
  authors: [{ name: "Contact Collector" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "Contact Collector",
    description: "Collect & manage contacts in vCard format",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Contact Collector",
    description: "Collect & manage contacts in vCard format",
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
