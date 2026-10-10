import { BadgeCheck } from "lucide-react";
import Link from "next/link";
import type { Role } from "@/db/schema";
import { ROLE_LABEL } from "@/lib/labels";
import { cx } from "../ui";

/** Name with the official mark for the No Competition team; evaluators are labelled. */
export function AuthorBadge({ name, handle, role, className }: { name: string; handle: string; role: Role; className?: string }) {
  return (
    <span className={cx("inline-flex min-w-0 items-center gap-1", className)}>
      <Link href={`/members/${handle}`} className="truncate font-semibold text-ink hover:underline">
        {name}
      </Link>
      {role === "investor" && (
        <span role="img" aria-label="Conta oficial No Competition" title="Conta oficial No Competition" className="shrink-0">
          <BadgeCheck aria-hidden className="size-[17px] fill-ink text-volt" />
        </span>
      )}
      {role === "evaluator" && <span className="shrink-0 rounded-full bg-violet-soft px-1.5 py-px text-[11px] font-medium text-violet">{ROLE_LABEL.evaluator}</span>}
    </span>
  );
}
