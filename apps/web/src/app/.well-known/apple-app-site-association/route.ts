// iOS Universal Links association. Served at
// /.well-known/apple-app-site-association with Content-Type application/json.
// Activates automatically once APPLE_TEAM_ID is set in the environment (after
// the Apple Developer account + bundle id exist); returns 404 until then so we
// never publish an invalid association file.
export function GET() {
  const teamId = process.env.APPLE_TEAM_ID;
  const bundleId = process.env.APPLE_BUNDLE_ID ?? "tn.chahia.app";
  if (!teamId) {
    return new Response("Not configured", { status: 404 });
  }
  return Response.json({
    applinks: {
      apps: [],
      details: [
        {
          appIDs: [`${teamId}.${bundleId}`],
          components: [{ "/": "/r/*", comment: "table QR deep links" }],
        },
      ],
    },
  });
}
