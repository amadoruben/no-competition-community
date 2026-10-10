import clsx from "clsx";
import Link from "next/link";

const INK = "#16130e";
const GOLD = "#c39b4a";

/**
 * The NCC mark: an empty set — ∅ — "no competition", drawn in gold on ink.
 * `light` draws it in ink on a gold tile, for the rare dark surface.
 */
export function BrandMark({ size = 32, className, light }: { size?: number; className?: string; light?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={clsx("shrink-0", className)} aria-hidden>
      <rect width="32" height="32" rx="9" fill={light ? GOLD : INK} />
      <circle cx="16" cy="16" r="7.4" fill="none" stroke={light ? INK : GOLD} strokeWidth="2.4" />
      <path d="M9.6 23.4 22.4 8.6" stroke={light ? INK : GOLD} strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Mark and name. `stacked` puts "Community" under the name; `compact` shows the
 * mark only; `nameClassName` lets a crowded header hide the name responsively.
 */
export function Brand({
  href = "/",
  compact,
  stacked,
  className,
  nameClassName,
  invert,
}: {
  href?: string;
  compact?: boolean;
  stacked?: boolean;
  className?: string;
  nameClassName?: string;
  invert?: boolean;
}) {
  return (
    <Link href={href} className={clsx("flex shrink-0 items-center gap-2.5", className)} aria-label="No Competition Community — início">
      <BrandMark />
      {!compact &&
        (stacked ? (
          <span className={clsx("flex flex-col leading-none", nameClassName)}>
            <span className={clsx("font-display text-[16px] font-bold tracking-tight", invert ? "text-white" : "text-ink")}>No Competition</span>
            <span className={clsx("mt-1 text-[10.5px] font-semibold tracking-[0.22em] uppercase", invert ? "text-gold" : "text-gold-strong")}>Community</span>
          </span>
        ) : (
          <span className={clsx("font-display text-[17px] leading-none font-bold tracking-tight", invert ? "text-white" : "text-ink", nameClassName)}>
            No Competition
            <span className={clsx("ml-1.5 text-[11px] font-semibold tracking-[0.2em] uppercase", invert ? "text-gold" : "text-gold-strong")}>Community</span>
          </span>
        ))}
    </Link>
  );
}
