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
  userScalable: false,
  themeColor: "#075E54",
};

export const metadata: Metadata = {
  title: "Contact Collector - vCard Contact Viewer",
  description:
    "Collect & manage your phone contacts in vCard format. View, copy, and download all your contacts easily on Android.",
  keywords: [
    "Contact Collector",
    "vCard",
    "contacts",
    "phone numbers",
    "contact manager",
    "vCard viewer",
    "Android contacts",
  ],
  authors: [{ name: "Contact Collector" }],
  manifest: "/manifest.json",
  icons: {
    icon: "/icon-512.png",
    apple: "/icon-512.png",
  },
  openGraph: {
    title: "Contact Collector - vCard Contact Viewer",
    description:
      "Collect & manage your phone contacts in vCard format. View, copy, and download all contacts easily.",
    url: "https://contact-collector.vercel.app",
    siteName: "Contact Collector",
    images: [
      {
        url: "/og-image.png",
        width: 1344,
        height: 768,
        alt: "Contact Collector - vCard Contact Viewer",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Contact Collector - vCard Contact Viewer",
    description:
      "Collect & manage your phone contacts in vCard format. View, copy, and download all contacts easily.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Contact Collector" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
