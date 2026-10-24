const encoder = new TextEncoder();
function base64(bytes) {
  let text = "";
  for (let offset = 0; offset < bytes.length; offset += 16384)
    text += String.fromCharCode(...bytes.subarray(offset, offset + 16384));
  return btoa(text);
}
function decode(text) {
  if (typeof text !== "string" || !/^[A-Za-z0-9+/]*={0,2}$/.test(text))
    throw new Error("Invalid backup encoding");
  return Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
}
function metadata(value) {
  return {
    format: value.format,
    algorithm: value.algorithm,
    key_id: value.key_id,
    project_ref: value.project_ref,
    created_at: value.created_at,
  };
}
export async function encryptSnapshot(snapshot, publicJwk) {
  const envelope = {
    format: "hanpun-backup-v1",
    algorithm: "RSA-OAEP-256+A256GCM",
    key_id: publicJwk.kid,
    project_ref: snapshot.project_ref,
    created_at: snapshot.exported_at,
  };
  const rsa = await crypto.subtle.importKey(
    "jwk",
    publicJwk,
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["encrypt"],
  );
  const aes = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt"],
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      additionalData: encoder.encode(JSON.stringify(metadata(envelope))),
    },
    aes,
    encoder.encode(JSON.stringify(snapshot)),
  );
  const wrapped = await crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    rsa,
    await crypto.subtle.exportKey("raw", aes),
  );
  return {
    ...envelope,
    encrypted_key: base64(new Uint8Array(wrapped)),
    iv: base64(iv),
    ciphertext: base64(new Uint8Array(ciphertext)),
  };
}
export async function decryptSnapshot(envelope, privatePem) {
  if (
    envelope.format !== "hanpun-backup-v1" ||
    envelope.algorithm !== "RSA-OAEP-256+A256GCM"
  )
    throw new Error("Unsupported backup format");
  const bytes = decode(
    privatePem.replace(/-----[^-]+-----/g, "").replace(/\s/g, ""),
  );
  const rsa = await crypto.subtle.importKey(
    "pkcs8",
    bytes,
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["decrypt"],
  );
  const raw = await crypto.subtle.decrypt(
    { name: "RSA-OAEP" },
    rsa,
    decode(envelope.encrypted_key),
  );
  const aes = await crypto.subtle.importKey(
    "raw",
    raw,
    { name: "AES-GCM" },
    false,
    ["decrypt"],
  );
  const plaintext = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: decode(envelope.iv),
      additionalData: encoder.encode(JSON.stringify(metadata(envelope))),
    },
    aes,
    decode(envelope.ciphertext),
  );
  return JSON.parse(new TextDecoder().decode(plaintext));
}
