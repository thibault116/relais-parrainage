import type { NextConfig } from "next";
const config: NextConfig = {
  env: {
    NEXT_PUBLIC_RELAIS_VERSION:
      process.env.VERCEL_DEPLOYMENT_ID ||
      process.env.VERCEL_GIT_COMMIT_SHA ||
      "local",
  },
  outputFileTracingIncludes: {
    "/api/admin/crm/extension": ["./extension/mentora-vinted/**/*"],
  },
  serverExternalPackages: ["pg"],
  async redirects() {
    return [
      {
        source: "/:path((?!api/cron/emails).*)",
        has: [{ type: "host", value: "relais-parrainage\\.vercel\\.app" }],
        destination: "https://mentora-resell.vercel.app/:path*",
        permanent: true,
      },
    ];
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
    ];
  },
};
export default config;
