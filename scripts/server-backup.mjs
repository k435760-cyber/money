import { mkdir, writeFile } from "node:fs/promises";
const endpoint =
  "https://dbneonomwrqwlbitwdtr.supabase.co/functions/v1/hanpun-backup";
const action = process.argv[2];
if (!["export", "ack"].includes(action)) throw new Error("Use export or ack");
if (
  !process.env.ACTIONS_ID_TOKEN_REQUEST_URL ||
  !process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN
)
  throw new Error("Run this only inside the authorized GitHub backup workflow");
const url = new URL(process.env.ACTIONS_ID_TOKEN_REQUEST_URL);
url.searchParams.set("audience", "hanpun-server-backup");
const identity = await fetch(url, {
  headers: {
    Authorization: `Bearer ${process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN}`,
  },
  signal: AbortSignal.timeout(20000),
});
if (!identity.ok)
  throw new Error(`Identity verification unavailable (${identity.status})`);
const { value: token } = await identity.json();
const response = await fetch(endpoint, {
  method: action === "export" ? "GET" : "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  ...(action === "ack"
    ? {
        body: JSON.stringify({
          artifact_id: process.env.BACKUP_ARTIFACT_ID,
          digest: process.env.BACKUP_ARTIFACT_DIGEST,
        }),
      }
    : {}),
  signal: AbortSignal.timeout(60000),
});
if (!response.ok)
  throw new Error(
    `Backup ${action} failed (${response.status}); no credentials or records logged`,
  );
const result = await response.json();
if (action === "export") {
  if (
    result.format !== "hanpun-backup-v1" ||
    !result.ciphertext ||
    !result.encrypted_key
  )
    throw new Error("The backup response was not encrypted");
  await mkdir(".backup-output", { recursive: true });
  await writeFile(
    ".backup-output/hanpun-ledger-backup.json",
    JSON.stringify(result),
    { mode: 0o600 },
  );
  console.log(
    "Encrypted snapshot ready. No plaintext ledger data stored in the runner.",
  );
} else if (!result.acknowledged)
  throw new Error("Artifact acknowledgement failed");
else console.log("Offsite encrypted artifact upload acknowledged.");
