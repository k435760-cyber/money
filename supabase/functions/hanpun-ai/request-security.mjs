export class RequestError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Bound actual UTF-8 bytes while reading, even without a Content-Length header.
export async function readBoundedJson(request, limit = 4_000_000) {
  if (
    request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !==
    "application/json"
  )
    throw new RequestError(415, "JSON 형식으로 다시 요청해주세요.");
  if (Number(request.headers.get("content-length") || 0) > limit)
    throw new RequestError(
      413,
      "이미지가 너무 커요. 작은 이미지로 다시 골라주세요.",
    );
  const reader = request.body?.getReader();
  if (!reader) throw new RequestError(400, "요청 내용을 확인해주세요.");
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const parts = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > limit)
        throw new RequestError(
          413,
          "이미지가 너무 커요. 작은 이미지로 다시 골라주세요.",
        );
      parts.push(decoder.decode(value, { stream: true }));
    }
    parts.push(decoder.decode());
    const body = JSON.parse(parts.join(""));
    if (body === null || typeof body !== "object" || Array.isArray(body))
      throw new RequestError(400, "요청 내용을 확인해주세요.");
    return body;
  } catch (error) {
    void reader.cancel().catch(() => {});
    if (error instanceof RequestError) throw error;
    throw new RequestError(
      400,
      "요청 내용을 읽지 못했어요. 다시 시도해주세요.",
    );
  } finally {
    reader.releaseLock();
  }
}

// Read claims only AFTER Auth.getUser has authenticated the complete token.
export function verifiedSessionId(token) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3 || parts[1].length > 16000) return null;
    const claims = JSON.parse(
      atob(parts[1].replaceAll("-", "+").replaceAll("_", "/")),
    );
    return typeof claims.session_id === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        claims.session_id,
      )
      ? claims.session_id
      : null;
  } catch {
    return null;
  }
}
