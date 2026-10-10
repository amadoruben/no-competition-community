import { describe, expect, it } from "vitest";
import { videoSource } from "../video";

describe("videoSource", () => {
  it("recognises YouTube links in their usual shapes", () => {
    for (const link of [
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10",
      "https://youtu.be/dQw4w9WgXcQ",
      "https://m.youtube.com/shorts/dQw4w9WgXcQ",
      "https://www.youtube.com/embed/dQw4w9WgXcQ",
    ])
      expect(videoSource(link)).toMatchObject({ kind: "youtube", id: "dQw4w9WgXcQ", embed: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0" });
  });

  it("recognises Vimeo and direct files", () => {
    expect(videoSource("https://vimeo.com/76979871")).toMatchObject({ kind: "vimeo", embed: "https://player.vimeo.com/video/76979871" });
    expect(videoSource("https://cdn.example.pt/ep1.mp4")).toMatchObject({ kind: "file", src: "https://cdn.example.pt/ep1.mp4" });
  });

  it("rejects anything else", () => {
    for (const link of ["", "nada", "http://youtu.be/dQw4w9WgXcQ", "https://evil.test/watch?v=dQw4w9WgXcQ", "javascript:alert(1)", "https://youtu.be/curto", "https://example.pt/page"])
      expect(videoSource(link)).toBeNull();
  });
});
