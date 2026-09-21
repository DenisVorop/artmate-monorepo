import Image from "next/image";
import { Check, Trophy } from "lucide-react";

import {
  formatLoyaltyDate,
  formatLoyaltyPoints,
  type LoyaltyAchievement,
} from "@/entities/loyalty";
import { Badge, Card, CardContent, DataState, Progress } from "@/shared/ui";
import { SectionTitle } from "@/shared/ui/typography";

export function Achievements({ items }: { items: LoyaltyAchievement[] }) {
  return (
    <section className="space-y-5" aria-labelledby="loyalty-achievements-title">
      <div>
        <SectionTitle id="loyalty-achievements-title">Ваши достижения</SectionTitle>
        <p className="mt-2 text-sm text-muted-foreground">
          Каждая работа и покупка — часть вашей творческой истории.
        </p>
      </div>
      {items.length === 0 ? (
        <DataState
          title="Достижений пока нет"
          description="Когда появятся достижения клуба, здесь будут их условия и ваш прогресс."
          className="max-w-none"
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <Card key={item.id} className={item.earnedAt ? "border-rose-200 bg-rose-50/30" : ""}>
              <CardContent className="flex h-full flex-col gap-4 p-5">
                <div className="flex items-center justify-between gap-3">
                  {item.imageUrl ? (
                    <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-white">
                      <Image
                        src={item.imageUrl}
                        alt=""
                        fill
                        sizes="64px"
                        className="object-contain"
                      />
                    </div>
                  ) : (
                    <span className="flex size-16 items-center justify-center rounded-xl bg-orange-50 text-orange-500">
                      <Trophy className="size-7" />
                    </span>
                  )}
                  {item.earnedAt && (
                    <Badge variant="secondary">
                      <Check className="size-3.5" />
                      Получено
                    </Badge>
                  )}
                </div>
                <div className="space-y-2">
                  <h3 className="font-semibold break-words">{item.title}</h3>
                  <p className="text-sm leading-6 break-words text-muted-foreground">
                    {item.description}
                  </p>
                </div>
                <div className="mt-auto space-y-3">
                  {item.rewardPoints > 0 && (
                    <p className="text-sm font-semibold text-rose-600">
                      +{formatLoyaltyPoints(item.rewardPoints)}
                    </p>
                  )}
                  {item.earnedAt ? (
                    <p className="text-xs text-muted-foreground">
                      Получено {formatLoyaltyDate(item.earnedAt)}
                    </p>
                  ) : (
                    <>
                      <div className="flex justify-between gap-3 text-sm">
                        <span className="text-muted-foreground">Прогресс</span>
                        <span>
                          {item.progress.toLocaleString("ru-RU")} /{" "}
                          {item.target.toLocaleString("ru-RU")}
                        </span>
                      </div>
                      <Progress
                        value={Math.min(100, (item.progress / item.target) * 100)}
                        aria-label={`${item.title}: ${item.progress} из ${item.target}`}
                      />
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
