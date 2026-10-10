import { cx } from "./ui";

/**
 * 3D illustrations (Microsoft Fluent Emoji, MIT — see
 * public/illustrations/LICENSE.txt). Decorative unless `alt` is given.
 */
export type ArtName =
  | "trophy"
  | "medal-1"
  | "medal-2"
  | "medal-3"
  | "medal"
  | "chart"
  | "rocket"
  | "bulb"
  | "megaphone"
  | "clapper"
  | "target"
  | "handshake"
  | "crown"
  | "globe"
  | "memo"
  | "check"
  | "lock"
  | "calendar"
  | "star"
  | "party"
  | "wave"
  | "speech"
  | "scale"
  | "compass"
  | "books";

export function Art({ name, size = 48, alt = "", className }: { name: ArtName; size?: number; alt?: string; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- tiny static webp, already the right size
    <img
      src={`/illustrations/${name}.webp`}
      width={size}
      height={size}
      alt={alt}
      aria-hidden={alt ? undefined : true}
      loading="lazy"
      decoding="async"
      draggable={false}
      className={cx("shrink-0 select-none", className)}
    />
  );
}

/** The illustration for a prize by final rank and kind (1st, 2nd, 3rd; investment; recognition). */
export function prizeArt(rank: number | null, kind: "prize" | "investment" | "recognition"): ArtName {
  if (kind === "investment") return "chart";
  if (rank === 1) return "medal-1";
  if (rank === 2) return "medal-2";
  if (rank === 3) return "medal-3";
  return kind === "recognition" ? "star" : "trophy";
}
