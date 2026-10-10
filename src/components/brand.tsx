import clsx from "clsx";
import Link from "next/link";

/** The mark is an empty set — ∅ — "no competition". */
export function BrandMark({ size = 30, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="9" fill="#101216" />
      <circle cx="16" cy="16" r="7.5" fill="none" stroke="#d4f24a" strokeWidth="2.6" />
      <path d="M9.5 23.5 22.5 8.5" stroke="#d4f24a" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

export function Brand({ href = "/", compact, stacked, className, invert }: { href?: string; compact?: boolean; stacked?: boolean; className?: string; invert?: boolean }) {
  return (
    <Link href={href} className={clsx("flex items-center gap-2.5", className)} aria-label="No Competition Community — início">
      <BrandMark />
      {stacked && !compact ? (
        <span className="flex flex-col font-display leading-none">
          <span className={clsx("text-[16px] font-bold tracking-tight", invert ? "text-white" : "text-ink")}>No Competition</span>
          <span className={clsx("mt-1 text-[12px] font-medium", invert ? "text-white/60" : "text-muted")}>Community</span>
        </span>
      ) : !compact && (
        <span className={clsx("font-display text-[17px] leading-none font-bold tracking-tight", invert ? "text-white" : "text-ink")}>
          No Competition
          <span className={clsx("ml-1 font-medium", invert ? "text-white/60" : "text-muted")}>Community</span>
        </span>
      )}
    </Link>
  );
}
