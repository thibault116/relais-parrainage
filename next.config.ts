import type { NextConfig } from "next";
const config: NextConfig = {
  env: {
    NEXT_PUBLIC_RELAIS_VERSION:
      process.env.VERCEL_DEPLOYMENT_ID ||
      process.env.VERCEL_GIT_COMMIT_SHA ||
      "local",
  },
  serverExternalPackages: ["pg"],
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "relais-parrainage\\.vercel\\.app" }],
        destination: "https://mentora-resell.vercel.app/:path*",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
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
