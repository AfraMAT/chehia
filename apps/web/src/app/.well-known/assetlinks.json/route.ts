// Android App Links association. Served at /.well-known/assetlinks.json.
// ANDROID_CERT_SHA256 may hold one or more comma-separated SHA-256 fingerprints
// (typically the EAS upload key AND the Google Play app-signing key). Returns
// 404 until configured so we never publish an invalid association file.
export function GET() {
  const sha = process.env.ANDROID_CERT_SHA256;
  const pkg = process.env.ANDROID_PACKAGE ?? "tn.chahia.app";
  if (!sha) {
    return new Response("Not configured", { status: 404 });
  }
  const fingerprints = sha.split(",").map((s) => s.trim()).filter(Boolean);
  return Response.json([
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: pkg,
        sha256_cert_fingerprints: fingerprints,
      },
    },
  ]);
}
