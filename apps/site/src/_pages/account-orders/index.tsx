import { AccountOrders } from "@/features/account";
import { routes } from "@/shared/constants";
import { Button } from "@/shared/ui";
import { Link } from "@/shared/ui/link";
import { PageTitle } from "@/shared/ui/typography";
import { ArrowLeft } from "lucide-react";

export function AccountOrdersPage() {
  return (
    <main className="container space-y-6 py-8 md:py-12">
      <Button asChild variant="ghost" className="-ml-3 min-h-11">
        <Link href={routes.account}>
          <ArrowLeft className="size-4" />
          Личный кабинет
        </Link>
      </Button>
      <div className="space-y-2">
        <PageTitle>Мои заказы</PageTitle>
        <p className="text-muted-foreground">Покупки, статусы и информация о доставке.</p>
      </div>
      <AccountOrders />
    </main>
  );
}
