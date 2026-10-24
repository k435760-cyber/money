import { createClient } from "@supabase/supabase-js";
import { createRemoteJWKSet, jwtVerify } from "jose";
import publicKey from "./recovery-public-key.json" with { type: "json" };
import { encryptSnapshot } from "./crypto.mjs";

const jwks = createRemoteJWKSet(
  new URL("https://token.actions.githubusercontent.com/.well-known/jwks"),
);
const headers = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};
Deno.serve(async (req: Request) => {
  const respond = (status: number, value: unknown) =>
    new Response(JSON.stringify(value), { status, headers });
  if (req.headers.has("origin"))
    return respond(403, { error: "Server backup endpoint only" });
  if (!["GET", "POST"].includes(req.method))
    return respond(405, { error: "Method not allowed" });
  const token = (req.headers.get("authorization") || "").replace(
    /^Bearer\s+/i,
    "",
  );
  if (!token)
    return respond(401, { error: "GitHub Actions identity required" });
  let claims;
  try {
    ({ payload: claims } = await jwtVerify(token, jwks, {
      issuer: "https://token.actions.githubusercontent.com",
      audience: "hanpun-server-backup",
      algorithms: ["RS256"],
      maxTokenAge: "10m",
    }));
    if (
      claims.repository_id !== "1431127078" ||
      claims.repository !== "k435760-cyber/money" ||
      claims.ref !== "refs/heads/main" ||
      claims.workflow_ref !==
        "k435760-cyber/money/.github/workflows/backup.yml@refs/heads/main" ||
      !["push", "schedule", "workflow_dispatch"].includes(
        String(claims.event_name),
      ) ||
      !/^\d{1,25}$/.test(String(claims.run_id))
    )
      throw new Error("Untrusted workflow");
  } catch {
    return respond(401, {
      error: "Verified main-branch backup workflow required",
    });
  }
  try {
    const secret =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
      JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}").default;
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, secret, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const run = String(claims.run_id);
    if (req.method === "POST") {
      const text = await req.text();
      if (text.length > 2000)
        return respond(413, { error: "Request too large" });
      const body = JSON.parse(text);
      const { error } = await admin.rpc("hanpun_backup_ack", {
        p_run_id: run,
        p_artifact_id: body.artifact_id,
        p_digest: body.digest,
      });
      if (error) throw error;
      return respond(200, { acknowledged: true });
    }
    const { data, error } = await admin.rpc("hanpun_backup_export", {
      p_run_id: run,
    });
    if (error || !data) throw error || new Error("No snapshot");
    return respond(200, await encryptSnapshot(data, publicKey));
  } catch {
    return respond(503, {
      error: "Backup could not complete; no plaintext was returned",
    });
  }
});
