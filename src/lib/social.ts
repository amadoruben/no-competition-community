import { videoSource } from "./video";

/*
 * Social networks. Two uses, both from links pasted by people:
 * - profiles (a member's Instagram, TikTok, YouTube or X), shown on their
 *   profile and in the "seguir nas redes" panel;
 * - publications the No Competition team selects for the community.
 * Only links are kept; the platform and handle are read from the link itself.
 * Nothing is fetched from the networks — no scraping, no unofficial APIs.
 */

export const SOCIAL_PLATFORMS = ["instagram", "tiktok", "youtube", "x"] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];
export type SocialLinks = Partial<Record<SocialPlatform, string>>;

export const SOCIAL_PLATFORM_LABEL: Record<SocialPlatform, string> = { instagram: "Instagram", tiktok: "TikTok", youtube: "YouTube", x: "X (Twitter)" };

/** The No Competition profiles linked from the public pages, as given by the owner. Add YouTube and X here once known. */
export const SOCIAL_PROFILES: { platform: SocialPlatform; handle: string; url: string }[] = [
  { platform: "instagram", handle: "manupolonc", url: "https://www.instagram.com/manupolonc/" },
  { platform: "tiktok", handle: "manupolonc", url: "https://www.tiktok.com/@manupolonc" },
];

const HANDLE = /^[A-Za-z0-9._]{1,30}$/;
const YT_HANDLE = /^[A-Za-z0-9._-]{3,30}$/;
const X_HANDLE = /^[A-Za-z0-9_]{1,15}$/;
const CODE = /^[A-Za-z0-9_-]{5,64}$/;

function parseUrl(raw: string) {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    return { host: u.hostname.toLowerCase().replace(/^(www\.|m\.|mobile\.)/, ""), parts: u.pathname.split("/").filter(Boolean) };
  } catch {
    return null;
  }
}

/**
 * A profile link in canonical form, from a full link or a bare "@handle".
 * Null when it is not a profile on that network (a post, another site, a script…).
 */
export function profileLink(platform: SocialPlatform, raw: string | null | undefined): string | null {
  const v = (raw ?? "").trim();
  if (!v) return null;
  // "manu.polo" is a handle; "instagram.com/manu.polo" and "https://…" are links.
  const scheme = /^https?:\/\//i.test(v);
  const looksLikeUrl = scheme || /^(www\.|m\.)?(instagram|tiktok|youtube|x|twitter)\.com(\/|$)/i.test(v);
  const bare = looksLikeUrl ? null : v.replace(/^@/, "");
  const url = looksLikeUrl ? parseUrl(scheme ? v : `https://${v}`) : null;
  if (platform === "instagram") {
    const h = bare ?? (url?.host === "instagram.com" && url.parts.length === 1 ? url.parts[0] : null);
    return h && HANDLE.test(h) && !["p", "reel", "reels", "explore", "accounts"].includes(h) ? `https://www.instagram.com/${h}/` : null;
  }
  if (platform === "tiktok") {
    const h = bare ?? (url?.host === "tiktok.com" && url.parts.length === 1 && url.parts[0].startsWith("@") ? url.parts[0].slice(1) : null);
    return h && HANDLE.test(h) ? `https://www.tiktok.com/@${h}` : null;
  }
  if (platform === "youtube") {
    if (bare !== null) return YT_HANDLE.test(bare) ? `https://www.youtube.com/@${bare}` : null;
    if (url?.host !== "youtube.com") return null;
    const [a, b] = url.parts;
    if (a?.startsWith("@") && YT_HANDLE.test(a.slice(1)) && url.parts.length === 1) return `https://www.youtube.com/${a}`;
    if (a === "channel" && b && /^UC[A-Za-z0-9_-]{22}$/.test(b) && url.parts.length === 2) return `https://www.youtube.com/channel/${b}`;
    return null;
  }
  const h = bare ?? ((url?.host === "x.com" || url?.host === "twitter.com") && url.parts.length === 1 ? url.parts[0] : null);
  return h && X_HANDLE.test(h) && !["home", "explore", "i", "search", "settings"].includes(h) ? `https://x.com/${h}` : null;
}

/** "@handle" (or the channel id) shown next to a profile link. */
export function profileHandle(platform: SocialPlatform, url: string): string {
  const parts = parseUrl(url)?.parts ?? [];
  const last = parts[parts.length - 1] ?? "";
  if (platform === "youtube" && parts[0] === "channel") return "Canal do YouTube";
  return `@${last.replace(/^@/, "")}`;
}

/** Keeps only valid, canonical profile links (data from the database is re-checked before display). */
export function cleanLinks(links: SocialLinks | null | undefined): SocialLinks {
  const out: SocialLinks = {};
  for (const p of SOCIAL_PLATFORMS) {
    const v = profileLink(p, links?.[p]);
    if (v) out[p] = v;
  }
  return out;
}

export type SocialSource = {
  platform: SocialPlatform;
  /** Canonical link to the original publication, without tracking parameters. */
  url: string;
  /** Handle without "@", only when the link itself names it. */
  creator: string | null;
  /** YouTube only: the official, privacy-enhanced player and thumbnail. */
  youtubeId: string | null;
};

/** Reads a pasted link to a publication; null for anything that is not a publication on a supported network. */
export function socialSource(raw: string | null | undefined): SocialSource | null {
  if (!raw) return null;
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  const host = u.hostname.toLowerCase().replace(/^(www\.|m\.|mobile\.)/, "");
  const parts = u.pathname.split("/").filter(Boolean);

  if (host === "instagram.com") {
    // /p/<code>/, /reel/<code>/, /tv/<code>/ — or the same under /<handle>/.
    const at = parts.findIndex((p) => ["p", "reel", "reels", "tv"].includes(p));
    const code = parts[at + 1];
    if (at < 0 || at > 1 || !code || !CODE.test(code)) return null;
    const creator = at === 1 && HANDLE.test(parts[0]) ? parts[0] : null;
    if (at === 1 && !creator) return null;
    const kind = parts[at] === "reels" ? "reel" : parts[at];
    return { platform: "instagram", url: `https://www.instagram.com/${creator ? `${creator}/` : ""}${kind}/${code}/`, creator, youtubeId: null };
  }

  if (host === "tiktok.com") {
    // /@<handle>/video/<id> or /@<handle>/photo/<id>
    const [who, kind, id] = parts;
    if (who?.startsWith("@") && HANDLE.test(who.slice(1)) && (kind === "video" || kind === "photo") && /^\d{6,25}$/.test(id ?? ""))
      return { platform: "tiktok", url: `https://www.tiktok.com/${who}/${kind}/${id}`, creator: who.slice(1), youtubeId: null };
    // Short links from the app's share button: /t/<code>/ (the creator is not in the link).
    if (who === "t" && CODE.test(kind ?? "")) return { platform: "tiktok", url: `https://www.tiktok.com/t/${kind}/`, creator: null, youtubeId: null };
    return null;
  }
  if (host === "vm.tiktok.com" || host === "vt.tiktok.com") {
    const [code] = parts;
    if (parts.length === 1 && CODE.test(code)) return { platform: "tiktok", url: `https://${host}/${code}/`, creator: null, youtubeId: null };
    return null;
  }

  if (host === "x.com" || host === "twitter.com") {
    // /<handle>/status/<id>
    const [who, kind, id] = parts;
    if (who && X_HANDLE.test(who) && kind === "status" && /^\d{5,25}$/.test(id ?? ""))
      return { platform: "x", url: `https://x.com/${who}/status/${id}`, creator: who, youtubeId: null };
    return null;
  }

  // YouTube links never name the channel; the official player shows it.
  const yt = videoSource(raw);
  if (yt?.kind === "youtube") return { platform: "youtube", url: `https://www.youtube.com/watch?v=${yt.id}`, creator: null, youtubeId: yt.id };
  return null;
}
