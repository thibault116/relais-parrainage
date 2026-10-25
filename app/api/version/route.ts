export const dynamic = "force-dynamic";
export function GET() {
  return Response.json(
    {
      version:
        process.env.VERCEL_DEPLOYMENT_ID ||
        process.env.VERCEL_GIT_COMMIT_SHA ||
        process.env.NEXT_PUBLIC_RELAIS_VERSION,
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "Vercel-CDN-Cache-Control": "no-store",
      },
    },
  );
}
