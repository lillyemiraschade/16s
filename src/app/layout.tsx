import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/layout/Providers";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://try16s.app";

export const metadata: Metadata = {
  title: "16s — Build websites by talking to AI",
  description: "Your dream website is just a phone call away. Join the waitlist for 16s.",
  metadataBase: new URL(APP_URL),
  openGraph: {
    title: "16s — Build websites by talking to AI",
    description: "Your dream website is just a phone call away. Join the waitlist for 16s.",
    url: APP_URL,
    siteName: "16s",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "16s — Build websites by talking to AI",
    description: "Your dream website is just a phone call away. Join the waitlist for 16s.",
  },
  alternates: {
    canonical: APP_URL,
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.png", type: "image/png" },
    ],
    apple: "/logo.png",
  },
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0a0a0b",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="icon" href="/favicon.png" type="image/png" />
      </head>
      <body className={`${inter.className} antialiased`}>
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        <noscript>
          <div style={{ padding: "2rem", textAlign: "center", color: "#fff", background: "#0a0a0b" }}>
            16s requires JavaScript to run. Please enable JavaScript in your browser.
          </div>
        </noscript>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
