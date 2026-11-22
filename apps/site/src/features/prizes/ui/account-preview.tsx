"use client";
import { ArrowRight } from "lucide-react";
import { useSession } from "@/entities/session";
import { routes } from "@/shared/constants";
import { Badge, Button, Card } from "@/shared/ui";
import { Link } from "@/shared/ui/link";
import { usePrizes } from "@/entities/prize";

export function AccountPrizesPreview() {
  const { user } = useSession();
  const { data } = usePrizes(user?.id ?? "");
  if (!user) return null;
  const count = data?.available.length ?? 0;
  return (
    <Card className="flex flex-wrap items-center justify-between gap-4 border-rose-100 bg-gradient-to-r from-rose-50/70 via-white to-orange-50/70 p-5 sm:flex-row sm:p-6">
      <div className="flex min-w-0 items-center gap-3">
        <h2 className="font-heading text-xl font-bold">Мои призы</h2>
        {count > 0 && <Badge className="border-0 bg-rose-100 text-rose-800">{count}</Badge>}
      </div>
      <Button asChild variant="outline" className="min-h-11">
        <Link href={routes.accountPrizes}>
          Посмотреть призы
          <ArrowRight aria-hidden className="size-4" />
        </Link>
      </Button>
    </Card>
  );
}
