import Link from "next/link";
import { cx } from "./ui";

const SECTIONS = [
  { key: "members", href: "/members", label: "Membros" },
  { key: "leaderboard", href: "/leaderboard", label: "Classificação" },
  { key: "projects", href: "/projects", label: "Projectos" },
] as const;

/** Membros groups people, rankings and projects under one navigation entry. */
export function MembersSwitch({ active }: { active: (typeof SECTIONS)[number]["key"] }) {
  return (
    <nav aria-label="Membros" className="mb-5 inline-flex rounded-full bg-sunken p-1">
      {SECTIONS.map((s) => (
        <Link
          key={s.key}
          href={s.href}
          aria-current={s.key === active ? "page" : undefined}
          className={cx("h-8 rounded-full px-3.5 text-[13px] leading-8 font-medium transition-colors", s.key === active ? "bg-surface text-ink shadow-[var(--shadow-card)]" : "text-muted hover:text-ink")}
        >
          {s.label}
        </Link>
      ))}
    </nav>
  );
}
