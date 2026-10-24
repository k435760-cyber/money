// Appearance-based estimates are uncertain; this is NOT proof of chronological age.
export function evaluateAgeEstimate(value) {
  if (
    !value ||
    value.face_count !== 1 ||
    value.usable !== true ||
    value.confidence !== "high"
  )
    return "unknown";
  const { min_age: min, max_age: max } = value;
  if (
    !Number.isInteger(min) ||
    !Number.isInteger(max) ||
    min < 0 ||
    max > 120 ||
    max - min < 4
  )
    return "unknown";
  if (value.age_band === "under14" && max < 14) return "under14";
  if (value.age_band === "14plus" && min >= 14) return "14plus";
  return "unknown";
}
const encode = (bytes) =>
  btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
const decode = (value) =>
  Uint8Array.from(
    atob(value.replaceAll("-", "+").replaceAll("_", "/")),
    (char) => char.charCodeAt(0),
  );
const keyFor = (secret) =>
  crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(`hanpun-face-age-v1:${secret}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
export async function signAgeToken(ageGroup, expires, secret) {
  const data = encode(
    new TextEncoder().encode(
      JSON.stringify({
        purpose: "hanpun-face-age-v1",
        age_group: ageGroup,
        exp: expires,
      }),
    ),
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    await keyFor(secret),
    new TextEncoder().encode(data),
  );
  return `${data}.${encode(new Uint8Array(signature))}`;
}
export async function readAgeToken(token, secret) {
  try {
    if (typeof token !== "string" || token.length > 2000) return "unknown";
    const [data, signature, extra] = token.split(".");
    if (
      extra ||
      !signature ||
      !(await crypto.subtle.verify(
        "HMAC",
        await keyFor(secret),
        decode(signature),
        new TextEncoder().encode(data),
      ))
    )
      return "unknown";
    const value = JSON.parse(new TextDecoder().decode(decode(data)));
    return value.purpose === "hanpun-face-age-v1" &&
      value.exp > Date.now() &&
      ["under14", "14plus"].includes(value.age_group)
      ? value.age_group
      : "unknown";
  } catch {
    return "unknown";
  }
}
