import type { NextConfig } from "next";
const config: NextConfig = {
  devIndicators: false,
  env: {
    NEXT_PUBLIC_RELAIS_VERSION:
      process.env.VERCEL_DEPLOYMENT_ID ||
      process.env.VERCEL_GIT_COMMIT_SHA ||
      "local",
  },
  outputFileTracingIncludes: {
    "/api/guides/*": ["./content/guides.bundle.enc"],
    "/api/admin/crm/extension": ["./extension/mentora-vinted/**/*"],
  },
  serverExternalPackages: ["pg"],
  async redirects() {
    return ["relais-parrainage\\.vercel\\.app"].map(host => ({
      source: "/:path((?!api/).*)",
      has: [{ type: "host" as const, value: host }],
      destination: "https://www.mentora-resell.app/:path*",
      permanent: true,
    }));
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },

      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
      {
        source: "/nouveau-mot-de-passe",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Cache-Control", value: "private, no-store, max-age=0" },
        ],
      },
    ];
  },
};
export default config;
