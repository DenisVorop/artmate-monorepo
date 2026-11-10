import { EmailSubscriptionSettings } from "@/features/email-subscription-settings";
import { AccountBackLink, AccountSettings } from "@/features/account";
import { PageTitle } from "@/shared/ui/typography";

export function AccountSettingsPage() {
  return (
    <main className="container space-y-6 py-8 md:py-12">
      <AccountBackLink />
      <div className="space-y-2">
        <PageTitle>Настройки аккаунта</PageTitle>
        <p className="text-muted-foreground">Ваши контакты, подписка и подключённые сервисы.</p>
      </div>
      <AccountSettings />
      <EmailSubscriptionSettings />
    </main>
  );
}
