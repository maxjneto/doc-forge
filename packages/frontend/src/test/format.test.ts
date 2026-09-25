import { describe, expect, it } from "vitest";
import { parseServerDate, timeAgo } from "@/utils/format";

describe("parseServerDate", () => {
  it("treats offset-less ISO timestamps as UTC", () => {
    expect(parseServerDate("2026-09-25T21:00:00").toISOString()).toBe("2026-09-25T21:00:00.000Z");
    expect(parseServerDate("2026-09-25T21:00:00.123456").toISOString()).toBe("2026-09-25T21:00:00.123Z");
  });

  it("keeps explicit offsets", () => {
    expect(parseServerDate("2026-09-25T21:00:00Z").toISOString()).toBe("2026-09-25T21:00:00.000Z");
    expect(parseServerDate("2026-09-25T21:00:00+00:00").toISOString()).toBe("2026-09-25T21:00:00.000Z");
    expect(parseServerDate("2026-09-25T18:00:00-03:00").toISOString()).toBe("2026-09-25T21:00:00.000Z");
  });
});

describe("timeAgo", () => {
  it("formats recent naive-UTC timestamps relative to now", () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60_000).toISOString().replace("Z", "");
    expect(timeAgo(fiveMinAgo)).toBe("5m ago");
  });
});
