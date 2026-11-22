import { Trophy } from "lucide-react";
import { routes } from "@/shared/constants";
import { Link } from "@/shared/ui/link";

export function PrizeContestLink({ slug, title }: { slug: string; title: string }) {
  return (
    <Link
      href={routes.contest(slug)}
      className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-sm py-2 text-sm leading-6 text-stone-500 hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Trophy aria-hidden="true" className="size-4 shrink-0" />
      <span className="min-w-0 break-words">{title}</span>
    </Link>
  );
}
