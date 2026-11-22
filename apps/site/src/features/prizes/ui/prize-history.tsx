import Image from "next/image";
import { routes } from "@/shared/constants";
import { Badge, Card } from "@/shared/ui";
import { Link } from "@/shared/ui/link";
import { albumQuantity, prizeDate } from "../lib/format";
import type { PrizeHistoryItem } from "../lib/types";
import { PromoPrizeCard } from "./promo-prize-card";
import { PrizeContestLink } from "./contest-link";

export function PrizeHistory({ items }: { items: readonly PrizeHistoryItem[] }) {
  return (
    <ul className="space-y-4">
      {items.map((item) => {
        if (item.kind === "promocode")
          return (
            <li key={item.id}>
              <PromoPrizeCard prize={item} />
            </li>
          );
        const albums = item.albums;
        const firstAlbum = albums[0];
        const title = albums.length === 1 ? firstAlbum!.title : albumQuantity(albums.length);
        return (
          <li key={item.id}>
            <Card className="grid grid-cols-[4rem_minmax(0,1fr)] items-start gap-4 rounded-2xl p-5 sm:grid-cols-[5rem_minmax(0,1fr)_auto] sm:gap-6 sm:p-6">
              <div className="relative flex aspect-[3/4] items-center justify-center overflow-hidden rounded-lg bg-stone-50">
                {firstAlbum?.image ? (
                  <Image
                    src={firstAlbum.image}
                    alt=""
                    fill
                    sizes="80px"
                    className="object-contain"
                  />
                ) : null}
              </div>
              <div className="min-w-0 space-y-2">
                <h2 className="font-heading text-lg font-bold sm:text-xl">{title}</h2>
                {albums.length > 1 && (
                  <p className="text-sm text-stone-600">
                    {albums.map((album) => album.title).join(", ")}
                  </p>
                )}
                <PrizeContestLink slug={item.contestSlug} title={item.contestTitle} />
              </div>
              <div className="col-start-2 space-y-2 sm:col-start-auto sm:text-right">
                <Badge variant="secondary">Оформлен</Badge>
                <Link
                  href={routes.accountOrders}
                  className="block min-h-11 py-2 text-sm underline underline-offset-4"
                >
                  Посмотреть заказ
                </Link>
                <time dateTime={item.usedAt} className="block text-sm text-muted-foreground">
                  {prizeDate(item.usedAt)}
                </time>
              </div>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
