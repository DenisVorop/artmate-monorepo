import { AccountBackLink } from "@/features/account";
import { AchievementGallery } from "@/features/achievements";
import { PageTitle } from "@/shared/ui/typography";

export function AccountAchievementsPage() {
  return (
    <main className="container space-y-8 py-8 md:py-12">
      <div className="space-y-4">
        <AccountBackLink />
        <PageTitle>Мои достижения</PageTitle>
        <p className="text-muted-foreground">Ваши открытия, творческие шаги и цели впереди.</p>
      </div>
      <AchievementGallery />
    </main>
  );
}
