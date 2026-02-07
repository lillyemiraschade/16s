/** @type {import('next').NextConfig} */

// CSP directives — unsafe-eval needed for Monaco Editor, unsafe-inline for Next.js/Tailwind
const cspDirectives = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://cdn.jsdelivr.net",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' https://cdn.jsdelivr.net data:",
  "img-src 'self' blob: data: https://*.vercel-storage.com https://*.supabase.co",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://cdn.jsdelivr.net",
  "worker-src 'self' blob:",
  "frame-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig = {
  // Increase body size limit for image uploads (10MB)
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  // Disable webpack persistent caching to prevent corruption issues
  webpack: (config, { dev }) => {
    if (dev) {
      config.cache = false;
    }
    return config;
  },
  poweredByHeader: false, // Finding 10: remove X-Powered-By
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(self), payment=(), usb=(), bluetooth=(), serial=(), display-capture=(), fullscreen=(self), autoplay=(self)" },
          { key: "Content-Security-Policy", value: cspDirectives },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
