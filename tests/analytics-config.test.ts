import { describe, expect, it } from "vitest";
import { parseMetaPixelId, parseTikTokPixelId } from "@/lib/analytics/config";

describe("IDs dos pixels", () => {
  it("aceita formatos válidos (com espaços/aspas tolerados)", () => {
    expect(parseMetaPixelId(" 123456789012345 ")).toBe("123456789012345");
    expect(parseMetaPixelId('"1234567890123456"')).toBe("1234567890123456");
    expect(parseTikTokPixelId("cabc123def456ghi789j")).toBe("CABC123DEF456GHI789J");
  });

  it("rejeita valores vazios ou que poderiam injetar código", () => {
    expect(parseMetaPixelId(undefined)).toBeNull();
    expect(parseMetaPixelId("123abc")).toBeNull();
    expect(parseMetaPixelId("123');alert(1);//")).toBeNull();
    expect(parseTikTokPixelId("<script>")).toBeNull();
    expect(parseTikTokPixelId("ABC")).toBeNull();
  });
});
