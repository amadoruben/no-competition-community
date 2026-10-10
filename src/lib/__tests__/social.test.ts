import { describe, expect, it } from "vitest";
import { cleanLinks, profileHandle, profileLink, socialSource } from "../social";

describe("profile links", () => {
  it("accept a link or a bare handle and keep one canonical form", () => {
    expect(profileLink("instagram", "@manupolonc")).toBe("https://www.instagram.com/manupolonc/");
    expect(profileLink("instagram", "manu.polo")).toBe("https://www.instagram.com/manu.polo/");
    expect(profileLink("instagram", "https://www.instagram.com/manupolonc/?hl=pt")).toBe("https://www.instagram.com/manupolonc/");
    expect(profileLink("tiktok", "https://www.tiktok.com/@manupolonc?_r=1&_t=ZS-9ARESvoTmwa")).toBe("https://www.tiktok.com/@manupolonc");
    expect(profileLink("youtube", "https://www.youtube.com/@NoCompetition")).toBe("https://www.youtube.com/@NoCompetition");
    expect(profileLink("x", "https://twitter.com/manupolo")).toBe("https://x.com/manupolo");
    expect(profileHandle("tiktok", "https://www.tiktok.com/@manupolonc")).toBe("@manupolonc");
  });

  it("refuse posts, other sites and scripts", () => {
    for (const [p, v] of [
      ["instagram", "https://www.instagram.com/p/ABCDE123/"],
      ["instagram", "https://evil.example/manupolonc"],
      ["instagram", "javascript:alert(1)"],
      ["youtube", "https://www.youtube.com/watch?v=dQw4w9WgXcQ"],
      ["x", "https://x.com/home"],
      ["tiktok", "https://www.tiktok.com/@a/video/123"],
    ] as const)
      expect(profileLink(p, v), `${p} ${v}`).toBeNull();
    expect(cleanLinks({ instagram: "javascript:alert(1)", x: "https://x.com/ok_name" })).toEqual({ x: "https://x.com/ok_name" });
  });
});

describe("publication links", () => {
  it("read the platform and, when the link names it, the creator", () => {
    expect(socialSource("https://www.instagram.com/reel/C9xYz12AbCd/?igsh=abc")).toEqual({ platform: "instagram", url: "https://www.instagram.com/reel/C9xYz12AbCd/", creator: null, youtubeId: null });
    expect(socialSource("https://www.tiktok.com/@manupolonc/video/7412345678901234567?lang=pt")).toMatchObject({ platform: "tiktok", creator: "manupolonc" });
    expect(socialSource("https://x.com/manupolo/status/1234567890123")).toMatchObject({ platform: "x", creator: "manupolo" });
    expect(socialSource("https://youtu.be/dQw4w9WgXcQ")).toMatchObject({ platform: "youtube", youtubeId: "dQw4w9WgXcQ", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" });
    expect(socialSource("http://www.instagram.com/p/ABCDE123/")).toBeNull();
    expect(socialSource("https://www.instagram.com/manupolonc/")).toBeNull();
    expect(socialSource("https://example.com/video")).toBeNull();
  });
});
