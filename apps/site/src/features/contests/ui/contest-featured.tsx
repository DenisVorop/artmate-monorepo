import { ContestBanner, contestBannerActionClasses } from "@repo/ui/contest-design";
import type { Contest } from "@/entities/contest";
import { routes } from "@/shared/constants";
import { Button, Card, CtaGradientLink } from "@/shared/ui";
import { Link } from "@/shared/ui/link";
import { ContestStatus } from "./contest-status";

export function ContestFeatured({ contest }: { contest: Contest }) {
  return (
    <ContestBanner
      contest={contest}
      card={Card}
      status={<ContestStatus stage={contest.stage} />}
      actions={
        <>
          {contest.stage === "open" && (
            <Button asChild size="lg" className={contestBannerActionClasses.primary}>
              <CtaGradientLink href={`${routes.contest(contest.slug)}?participate=1`}>
                Принять участие
              </CtaGradientLink>
            </Button>
          )}
          <Button
            asChild
            variant="outline"
            size="lg"
            className={contestBannerActionClasses.secondary}
          >
            <Link href={routes.contest(contest.slug)}>Условия и работы</Link>
          </Button>
        </>
      }
    />
  );
}
