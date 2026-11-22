"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession, type AuthUser } from "@/entities/session";
import { usePrize, usePrizes } from "@/entities/prize";
import { routes } from "@/shared/constants";
import { Button, DataState } from "@/shared/ui";
import { Link } from "@/shared/ui/link";
import { PrizeList } from "./prize-list";
import { AlbumSelection } from "./album-selection";
import { PrizeCheckout } from "./prize-checkout";
export function MyPrizes({
  view = "list",
  prizeId,
}: {
  view?: "list" | "albums" | "checkout";
  prizeId?: string;
}) {
  const { user, isPending } = useSession();
  if (isPending) return <p role="status">Загружаем призы…</p>;
  if (!user)
    return (
      <div className="space-y-4">
        <h1 className="font-heading text-2xl font-bold">Войдите в аккаунт</h1>
        <Button asChild>
          <Link href={`${routes.auth}?next=${encodeURIComponent(routes.accountPrizes)}`}>
            Войти
          </Link>
        </Button>
      </div>
    );
  return view === "list" ? (
    <PrizeListContent owner={user.id} />
  ) : (
    <PrizeDetail user={user} id={prizeId ?? ""} view={view} />
  );
}
function PrizeListContent({ owner }: { owner: string }) {
  const { data, isError, isPending, refetch } = usePrizes(owner);
  if (isPending) return <p role="status">Загружаем призы…</p>;
  if (isError || !data) return <LoadError retry={() => void refetch()} />;
  return <PrizeList prizes={data.available} history={data.history} />;
}
function PrizeDetail({
  user,
  id,
  view,
}: {
  user: AuthUser;
  id: string;
  view: "albums" | "checkout";
}) {
  const { data: prize, isError, isPending, refetch } = usePrize(user.id, id);
  if (isPending) return <p role="status">Загружаем приз…</p>;
  if (isError) return <LoadError retry={() => void refetch()} />;
  if (!prize) return <DataState title="Приз не найден" description="Вернитесь к списку призов." />;
  if (prize.orderId) return <PrizeOrderRedirect />;
  return view === "albums" ? (
    <AlbumSelection key={`${user.id}:${id}`} owner={user.id} prize={prize} />
  ) : (
    <PrizeCheckout key={`${user.id}:${id}`} user={user} prize={prize} />
  );
}
function PrizeOrderRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace(routes.accountOrders);
  }, [router]);
  return <p role="status">Открываем заказы…</p>;
}
function LoadError({ retry }: { retry: () => void }) {
  return (
    <div className="space-y-4">
      <p>Не удалось загрузить призы</p>
      <Button variant="outline" onClick={retry}>
        Попробовать снова
      </Button>
    </div>
  );
}
