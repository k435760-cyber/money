import { readFile } from "node:fs/promises";
import { decryptSnapshot } from "../supabase/functions/hanpun-backup/crypto.mjs";
const args = process.argv.slice(2);
const value = (name) => {
  const i = args.indexOf(name);
  return i < 0 ? undefined : args[i + 1];
};
if (!value("--backup") || !value("--key"))
  throw new Error(
    "Use --backup ENCRYPTED_JSON --key PRIVATE_PEM [--url SUPABASE_URL --service-key-file FILE --user-map JSON_FILE --apply]",
  );
const envelope = JSON.parse(await readFile(value("--backup"), "utf8"));
const snapshot = await decryptSnapshot(
  envelope,
  await readFile(value("--key"), "utf8"),
);
if (
  snapshot.version !== 1 ||
  ![2, 3].includes(snapshot.schema_version) ||
  !Array.isArray(snapshot.entities) ||
  !Array.isArray(snapshot.accounts)
)
  throw new Error("Invalid snapshot schema");
const counts = {
  active: snapshot.entities.filter((row) => !row.deleted_at).length,
  deleted: snapshot.entities.filter((row) => row.deleted_at).length,
  accounts: snapshot.accounts.length,
};
console.log(
  JSON.stringify({ verified: true, exported_at: snapshot.exported_at, counts }),
);
if (value("--url")) {
  if (!value("--service-key-file"))
    throw new Error(
      "A server-only service key file is required; never pass the key as a command-line value",
    );
  const key = (await readFile(value("--service-key-file"), "utf8")).trim();
  const map = value("--user-map")
    ? JSON.parse(await readFile(value("--user-map"), "utf8"))
    : {};
  const response = await fetch(
    `${value("--url").replace(/\/$/, "")}/rest/v1/rpc/hanpun_restore_backup`,
    {
      method: "POST",
      headers: {
        apikey: key,
        ...(key.startsWith("eyJ") ? { Authorization: `Bearer ${key}` } : {}),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_snapshot: snapshot,
        p_user_map: map,
        p_apply: args.includes("--apply"),
      }),
      signal: AbortSignal.timeout(60000),
    },
  );
  if (!response.ok)
    throw new Error(
      `Restore refused (${response.status}); no existing records were overwritten`,
    );
  console.log(JSON.stringify(await response.json()));
} else if (args.includes("--apply"))
  throw new Error("--apply also requires --url and --service-key-file");
else
  console.log(
    "Read-only decryption check complete. Nothing was written or deleted.",
  );
