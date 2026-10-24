import { describe, it, expect } from "vitest";
import { generateKeyPairSync } from "node:crypto";
import {
  encryptSnapshot,
  decryptSnapshot,
} from "../supabase/functions/hanpun-backup/crypto.mjs";
const pair = generateKeyPairSync("rsa", { modulusLength: 2048 });
const publicKey = {
  ...pair.publicKey.export({ format: "jwk" }),
  kid: "test-key",
};
const privateKey = pair.privateKey.export({ format: "pem", type: "pkcs8" });
const snapshot = {
  version: 1,
  schema_version: 2,
  project_ref: "test",
  exported_at: "2026-10-24T00:00:00Z",
  entities: [{ payload: { title: "private sample", amount: 100 } }],
  accounts: [],
};
describe("offsite backup envelope", () => {
  it("can recover without any Supabase-side key or database", async () => {
    const envelope = await encryptSnapshot(snapshot, publicKey);
    expect(JSON.stringify(envelope)).not.toContain("private sample");
    expect(await decryptSnapshot(envelope, privateKey)).toEqual(snapshot);
  });
  it("rejects modified metadata and ciphertext", async () => {
    const envelope = await encryptSnapshot(snapshot, publicKey);
    await expect(
      decryptSnapshot({ ...envelope, project_ref: "different" }, privateKey),
    ).rejects.toThrow();
    const changed =
      (envelope.ciphertext[0] === "A" ? "B" : "A") +
      envelope.ciphertext.slice(1);
    await expect(
      decryptSnapshot({ ...envelope, ciphertext: changed }, privateKey),
    ).rejects.toThrow();
  });
});
