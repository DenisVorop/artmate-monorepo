import { ArrowLeft } from "lucide-react";
import { AchievementGallery } from "@/features/achievements";
import { routes } from "@/shared/constants";
import { Button } from "@/shared/ui";
import { Link } from "@/shared/ui/link";
import { PageTitle } from "@/shared/ui/typography";

export function AccountAchievementsPage() {
  return (
    <main className="container space-y-8 py-8 md:py-12">
      <div className="space-y-4">
        <Button asChild variant="ghost" className="-ml-3 min-h-11">
          <Link href={routes.account}>
            <ArrowLeft className="size-4" />
            Личный кабинет
          </Link>
        </Button>
        <PageTitle>Мои достижения</PageTitle>
        <p className="text-muted-foreground">Ваши открытия, творческие шаги и цели впереди.</p>
      </div>
      <AchievementGallery />
    </main>
  );
}
