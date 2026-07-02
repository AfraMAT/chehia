import { describe, expect, it } from "vitest";
import { buildTableUrl, parseTableUrl } from "../deeplink";

describe("deep links", () => {
  it("builds the QR url", () => {
    expect(buildTableUrl("https://chehia.app", { slug: "cafe-el-marsa", qrToken: "demo-elmarsa-t12" })).toBe(
      "https://chehia.app/r/cafe-el-marsa/t/demo-elmarsa-t12",
    );
  });

  it("tolerates trailing slashes on the base", () => {
    expect(buildTableUrl("https://chehia.app/", { slug: "a", qrToken: "b" })).toBe("https://chehia.app/r/a/t/b");
  });

  it("parses full urls and bare paths", () => {
    expect(parseTableUrl("https://chehia.app/r/cafe-el-marsa/t/tok123")).toEqual({
      slug: "cafe-el-marsa",
      qrToken: "tok123",
    });
    expect(parseTableUrl("/r/cafe-el-marsa/t/tok123/")).toEqual({ slug: "cafe-el-marsa", qrToken: "tok123" });
  });

  it("rejects non-table paths", () => {
    expect(parseTableUrl("/business/orders")).toBeNull();
    expect(parseTableUrl("/r/only-slug")).toBeNull();
  });

  it("round-trips", () => {
    const link = { slug: "le-zink", qrToken: "demo-lezink-t01" };
    expect(parseTableUrl(buildTableUrl("http://localhost:3000", link))).toEqual(link);
  });
});
