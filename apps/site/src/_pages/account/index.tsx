import { AchievementGallery } from "@/features/achievements";
import {
  Account,
  AccountClubPreview,
  AccountOrders,
  AccountWelcomePromo,
  AccountWorkshopPreview,
} from "@/features/account";

export function AccountPage() {
  return (
    <main className="container space-y-8 py-8 md:space-y-10 md:py-12">
      <Account />
      <AccountClubPreview />
      <AchievementGallery preview />
      <AccountWorkshopPreview />
      <AccountOrders preview />
      <AccountWelcomePromo />
    </main>
  );
}
