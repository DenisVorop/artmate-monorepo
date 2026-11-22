import Image from "next/image";
import { routes } from "@/shared/constants";
import {
  Badge,
  Button,
  Card,
  CtaGradientLink,
  PageHero,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/shared/ui";
import { Link } from "@/shared/ui/link";
import type { AlbumPrize, AvailablePrize, PrizeHistoryItem } from "../lib/types";
import { prizeDate, prizeTitle } from "../lib/format";
import { usePrizeListState } from "../lib/ui-state";
import { PromoPrizeCard } from "./promo-prize-card";
import { PrizeHistory } from "./prize-history";
import { PrizeContestLink } from "./contest-link";

export function PrizeList({
  prizes,
  history,
}: {
  prizes: readonly AvailablePrize[];
  history: readonly PrizeHistoryItem[];
}) {
  const { tab, setTab } = usePrizeListState();
  return (
    <div className="space-y-8 md:space-y-10">
      <PageHero
        title="Мои призы"
        breadcrumbs={[{ label: "Личный кабинет", href: routes.account }, { label: "Мои призы" }]}
      />
      {!prizes.length && !history.length ? (
        <div className="space-y-5 rounded-2xl border py-12 text-center">
          <h2 className="font-heading text-xl font-bold">Призов пока нет</h2>
          <Button asChild variant="outline">
            <Link href={routes.contests}>Посмотреть конкурсы</Link>
          </Button>
        </div>
      ) : (
        <Tabs value={tab} onValueChange={setTab} className="gap-6">
          <TabsList variant="line" className="w-full justify-start gap-5 border-b pb-2">
            <TabsTrigger value="available" className="min-h-11">
              Доступны <span className="ml-1 text-muted-foreground">{prizes.length}</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="min-h-11">
              История <span className="ml-1 text-muted-foreground">{history.length}</span>
            </TabsTrigger>
          </TabsList>
          <TabsContent value="available" className="m-0 space-y-6">
            {!prizes.length && (
              <p className="py-10 text-center text-muted-foreground">Доступных призов пока нет</p>
            )}
            <div className="grid items-stretch gap-5 lg:grid-cols-2">
              {prizes.map((prize) =>
                prize.kind === "albums" ? (
                  <AlbumPrizeCard key={prize.id} prize={prize} />
                ) : (
                  <PromoPrizeCard key={prize.id} prize={prize} className="lg:col-span-2" />
                ),
              )}
            </div>
          </TabsContent>
          <TabsContent value="history" className="m-0">
            {history.length ? (
              <PrizeHistory items={history} />
            ) : (
              <p className="py-10 text-center text-muted-foreground">История призов пока пуста</p>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
function AlbumPrizeCard({ prize }: { prize: AlbumPrize }) {
  const covers = prize.albums;
  return (
    <Card className="gap-0 overflow-hidden rounded-2xl border-rose-100 bg-gradient-to-br from-rose-50/70 via-white to-orange-50/70 py-0">
      <div className="grid h-full grid-cols-[5rem_minmax(0,1fr)] gap-x-4 gap-y-5 p-4 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-x-7 sm:p-7">
        <div
          aria-hidden="true"
          className="relative row-span-2 flex items-center justify-center self-center py-3"
        >
          {prize.quantity > 1 && covers[1]?.image && (
            <div className="absolute inset-y-3 right-0 left-2 rotate-9 overflow-hidden rounded-lg border border-orange-100 bg-orange-50 shadow-sm">
              <Image src={covers[1].image} alt="" fill sizes="144px" className="object-contain" />
            </div>
          )}
          {covers[0]?.image && (
            <div className="relative aspect-[3/4] w-full -rotate-5 overflow-hidden rounded-lg bg-white shadow-sm">
              <Image src={covers[0].image} alt="" fill sizes="144px" className="object-contain" />
            </div>
          )}
        </div>
        <div className="min-w-0 space-y-3">
          <Badge className="border-0 bg-rose-100 text-rose-800">Ваш приз</Badge>
          <h2 className="font-heading text-xl leading-snug font-bold sm:text-2xl">
            {prizeTitle(prize.quantity)}
          </h2>
          <PrizeContestLink slug={prize.contestSlug} title={prize.contestTitle} />
          <time dateTime={prize.awardedAt} className="block text-sm text-muted-foreground">
            {prizeDate(prize.awardedAt)}
          </time>
        </div>
        <Button
          asChild
          size="lg"
          className="min-h-12 w-full self-end border-0 bg-gradient-to-r from-rose-500 via-rose-400 to-orange-400 text-white"
        >
          <CtaGradientLink href={routes.prizeAlbums(prize.id)}>
            {prize.quantity === 1 ? "Выбрать альбом" : "Выбрать альбомы"}
          </CtaGradientLink>
        </Button>
      </div>
    </Card>
  );
}
