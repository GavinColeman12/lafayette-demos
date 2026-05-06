import { describe, it, expect } from "vitest";
import { igRecordsToCandidates } from "@/lib/brand-assets/sources/instagram";

describe("instagram source adapter", () => {
  it("converts an Apify post record to a candidate", () => {
    const record = {
      shortCode: "ABC123",
      url: "https://instagram.com/p/ABC123",
      caption: "Pain au chocolat morning",
      displayUrl: "https://example.com/img.jpg",
      likesCount: 1200,
      commentsCount: 30,
      timestamp: "2026-04-01T08:00:00Z",
    };
    const out = igRecordsToCandidates("lafayette380", [record]);
    expect(out).toHaveLength(1);
    expect(out[0].source).toBe("instagram");
    expect(out[0].originalUrl).toBe(record.displayUrl);
    expect(out[0].caption).toBe(record.caption);
    expect(out[0].engagementScore).toBe(1200 + 30 * 3);
  });

  it("filters out records without displayUrl", () => {
    const records = [{ shortCode: "X" }, { shortCode: "Y", displayUrl: "https://y.jpg" }];
    expect(igRecordsToCandidates("b", records)).toHaveLength(1);
  });

  it("sorts by engagement score descending", () => {
    const records = [
      { displayUrl: "https://low.jpg", likesCount: 10 },
      { displayUrl: "https://high.jpg", likesCount: 1000 },
      { displayUrl: "https://mid.jpg", likesCount: 100 },
    ];
    const out = igRecordsToCandidates("b", records);
    expect(out.map((c) => c.originalUrl)).toEqual(["https://high.jpg", "https://mid.jpg", "https://low.jpg"]);
  });

  it("falls back to imageUrl + image fields", () => {
    expect(igRecordsToCandidates("b", [{ imageUrl: "https://a.jpg" }])).toHaveLength(1);
    expect(igRecordsToCandidates("b", [{ image: "https://b.jpg" }])).toHaveLength(1);
  });
});
