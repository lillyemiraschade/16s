import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/layout/Providers";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "16s — AI Web Designer",
  description: "Describe your dream website in plain English. 16s builds it in seconds with AI — live preview, one-click deploy.",
  metadataBase: new URL("https://16s-ruddy.vercel.app"),
  openGraph: {
    title: "16s — AI Web Designer",
    description: "Describe your dream website in plain English. 16s builds it in seconds with AI.",
    url: "https://16s-ruddy.vercel.app",
    siteName: "16s",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "16s — AI Web Designer",
    description: "Describe your dream website in plain English. 16s builds it in seconds with AI.",
  },
  alternates: {
    canonical: "https://16s-ruddy.vercel.app",
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
