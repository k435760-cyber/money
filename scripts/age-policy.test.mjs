import { describe, expect, it } from "vitest";
import {
  evaluateAgeEstimate,
  readAgeToken,
  signAgeToken,
} from "../supabase/functions/hanpun-ai/age-policy.mjs";
const adult = {
  face_count: 1,
  usable: true,
  confidence: "high",
  min_age: 25,
  max_age: 40,
  age_band: "14plus",
};
describe("AI face age feature restrictions", () => {
  it("keeps borderline, uncertain, implausible or multiple-face results restricted", () => {
    expect(evaluateAgeEstimate(adult)).toBe("14plus");
    expect(
      evaluateAgeEstimate({
        ...adult,
        min_age: 4,
        max_age: 10,
        age_band: "under14",
      }),
    ).toBe("under14");
    for (const patch of [
      { min_age: 12, max_age: 17 },
      { confidence: "low" },
      { face_count: 0 },
      { face_count: 2 },
      { usable: false },
      { min_age: 17, max_age: 17 },
      { max_age: 150 },
      { min_age: -2 },
      { age_band: "under14" },
      { min_age: null },
    ])
      expect(evaluateAgeEstimate({ ...adult, ...patch })).toBe("unknown");
  });
  it("does not accept forged, expired or differently signed guest proofs", async () => {
    const token = await signAgeToken(
      "14plus",
      Date.now() + 60000,
      "test-server-secret",
    );
    expect(await readAgeToken(token, "test-server-secret")).toBe("14plus");
    expect(await readAgeToken(token + "x", "test-server-secret")).toBe(
      "unknown",
    );
    expect(await readAgeToken(token, "other-secret")).toBe("unknown");
    expect(
      await readAgeToken(
        await signAgeToken("14plus", Date.now() - 1, "test-server-secret"),
        "test-server-secret",
      ),
    ).toBe("unknown");
    expect(await readAgeToken("14plus", "test-server-secret")).toBe("unknown");
  });
});
