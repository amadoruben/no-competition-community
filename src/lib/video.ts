/**
 * Video sources the library accepts: YouTube, Vimeo or a direct https file.
 * The stored value is the link the admin pasted; playback always goes through
 * `videoSource`, so only these providers are ever embedded.
 */
export type VideoSource =
  | { kind: "youtube"; id: string; embed: string; thumbnail: string }
  | { kind: "vimeo"; id: string; embed: string; thumbnail: null }
  | { kind: "file"; src: string; thumbnail: null };

const YT_ID = /^[\w-]{11}$/;

export function videoSource(raw: string | null | undefined): VideoSource | null {
  if (!raw) return null;
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  const host = u.hostname.replace(/^(www\.|m\.)/, "");
  let yt: string | null = null;
  if (host === "youtu.be") yt = u.pathname.slice(1).split("/")[0];
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (u.pathname === "/watch") yt = u.searchParams.get("v");
    else {
      const [, kind, id] = u.pathname.split("/");
      if (["embed", "shorts", "live"].includes(kind)) yt = id;
    }
  }
  if (yt && YT_ID.test(yt))
    return { kind: "youtube", id: yt, embed: `https://www.youtube-nocookie.com/embed/${yt}?rel=0`, thumbnail: `https://i.ytimg.com/vi/${yt}/hqdefault.jpg` };
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const id = u.pathname.split("/").filter(Boolean).find((s) => /^\d+$/.test(s));
    if (id) return { kind: "vimeo", id, embed: `https://player.vimeo.com/video/${id}`, thumbnail: null };
  }
  if (/\.(mp4|webm|m4v|mov)$/i.test(u.pathname)) return { kind: "file", src: u.toString(), thumbnail: null };
  return null;
}
