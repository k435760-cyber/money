import { describe, expect, it } from "vitest";
import {
  readBoundedJson,
  verifiedSessionId,
} from "../supabase/functions/hanpun-ai/request-security.mjs";
const request = (body, extra = {}) =>
  new Request("https://example.invalid", {
    method: "POST",
    headers: { "content-type": "application/json", ...extra },
    body,
    duplex: "half",
  });
describe("bounded untrusted AI request bodies", () => {
  it("rejects oversized UTF-8 bytes even with a forged small length", async () => {
    await expect(
      readBoundedJson(
        request(JSON.stringify({ x: "한".repeat(10) }), {
          "content-length": "1",
        }),
        25,
      ),
    ).rejects.toMatchObject({ status: 413 });
  });
  it("stops a chunked request before reading the remainder", async () => {
    let pulled = 0,
      cancelled = false;
    const stream = new ReadableStream({
      pull(c) {
        pulled++;
        c.enqueue(new Uint8Array(100));
        if (pulled === 1000) c.close();
      },
      cancel() {
        cancelled = true;
      },
    });
    await expect(readBoundedJson(request(stream), 150)).rejects.toMatchObject({
      status: 413,
    });
    expect(cancelled).toBe(true);
    expect(pulled).toBeLessThan(1000);
  });
  it("accepts JSON split inside a multibyte character and rejects bad UTF-8 or scalar JSON", async () => {
    const bytes = new TextEncoder().encode('{"x":"한"}');
    const stream = new ReadableStream({
      start(c) {
        c.enqueue(bytes.slice(0, 7));
        c.enqueue(bytes.slice(7));
        c.close();
      },
    });
    expect(await readBoundedJson(request(stream))).toEqual({ x: "한" });
    for (const body of ["null", "[]", "not-json", new Uint8Array([0xff])])
      await expect(readBoundedJson(request(body))).rejects.toMatchObject({
        status: 400,
      });
    await expect(
      readBoundedJson(request("{}", { "content-type": "text/plain" })),
    ).rejects.toMatchObject({ status: 415 });
  });
  it("extracts only a well-formed session ID after independent token validation", () => {
    const sid = "12345678-1234-1234-1234-123456789abc";
    const jwt = (payload) =>
      `header.${btoa(JSON.stringify(payload))}.signature`;
    expect(verifiedSessionId(jwt({ session_id: sid }))).toBe(sid);
    expect(verifiedSessionId(jwt({ session_id: "not-uuid" }))).toBeNull();
    expect(verifiedSessionId("broken")).toBeNull();
  });
});
