import { AccountBackLink, AccountOrders } from "@/features/account";
import { PageTitle } from "@/shared/ui/typography";

export function AccountOrdersPage() {
  return (
    <main className="container space-y-6 py-8 md:py-12">
      <AccountBackLink />
      <div className="space-y-2">
        <PageTitle>Мои заказы</PageTitle>
        <p className="text-muted-foreground">Покупки, статусы и информация о доставке.</p>
      </div>
      <AccountOrders />
    </main>
  );
}
