import { describe, it, expect } from "vitest";
import { extractImagesFromHtml } from "@/lib/brand-assets/sources/website";

describe("website source adapter", () => {
  it("extracts <img src> tags + og:image", () => {
    const html = `
      <html>
      <head>
        <meta property="og:image" content="https://lafayette.com/og-hero.jpg">
      </head>
      <body>
        <img src="https://lafayette.com/img1.jpg" alt="croissant">
        <img src="/relative.png" alt="frites">
        <img src="data:image/png;base64,...">
      </body>
      </html>
    `;
    const out = extractImagesFromHtml(html, "https://lafayette.com");
    const urls = out.map((c) => c.originalUrl);
    expect(urls).toContain("https://lafayette.com/og-hero.jpg");
    expect(urls).toContain("https://lafayette.com/img1.jpg");
    expect(urls).toContain("https://lafayette.com/relative.png");
    expect(urls.find((u) => u.startsWith("data:"))).toBeUndefined();
  });

  it("dedupes repeated image URLs", () => {
    const html = `<img src="/a.jpg"><img src="/a.jpg"><img src="https://x.com/a.jpg">`;
    const out = extractImagesFromHtml(html, "https://x.com");
    expect(out).toHaveLength(1);
  });

  it("attaches alt text as caption when present", () => {
    const html = `<img src="/a.jpg" alt="golden croissant">`;
    const out = extractImagesFromHtml(html, "https://x.com");
    expect(out[0].caption).toBe("golden croissant");
  });
});
