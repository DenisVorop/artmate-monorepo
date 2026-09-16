"use client";

import { Eye, Pause, Pencil, Play, UsersRound } from "lucide-react";
import Link from "next/link";

import {
  formatKopecks,
  formatPromoCodeDate,
  formatPromoCodeValue,
  getPromoCodeStatus,
  usePromoCodes,
} from "@/entities/promocodes";
import { routes } from "@/shared/constants";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui";

import { getTogglePromoCodeInput } from "../lib";
import { useUpdatePromoCode } from "../model";

export function PromoCodesManagement() {
  const { isError, isPending, promoCodes } = usePromoCodes();
  const { isPending: isToggling, mutate: updatePromoCode } =
    useUpdatePromoCode();

  if (isError || isPending || promoCodes.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            {isError
              ? "Не удалось загрузить промокоды"
              : isPending
                ? "Загрузка промокодов"
                : "Промокодов пока нет"}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {isError
            ? "Перезагрузите страницу и повторите действие."
            : isPending
              ? "Получаем настройки и статистику применений."
              : "Создайте первый промокод для покупателей."}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Список промокодов</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Код / название</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead>Скидка</TableHead>
              <TableHead>Период, МСК</TableHead>
              <TableHead>Использовано / резерв</TableHead>
              <TableHead>Лимиты</TableHead>
              <TableHead className="w-28 text-right">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {promoCodes.map((promoCode) => {
              const status = getPromoCodeStatus(promoCode);

              return (
                <TableRow key={promoCode.id}>
                  <TableCell>
                    <p className="font-mono font-medium">{promoCode.code}</p>
                    <p className="text-xs text-muted-foreground">
                      {promoCode.name}
                    </p>
                    {promoCode.kind === "welcome" ? (
                      <Badge className="mt-1" variant="outline">
                        Приветственный
                      </Badge>
                    ) : null}
                    {promoCode.kind === "affiliate" ? (
                      <Badge className="mt-1" variant="outline">
                        Партнёрский
                      </Badge>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </TableCell>
                  <TableCell>
                    <p>{formatPromoCodeValue(promoCode)}</p>
                    {promoCode.type === "percentage" &&
                    promoCode.maxDiscountKopecks != null ? (
                      <p className="text-xs text-muted-foreground">
                        максимум {formatKopecks(promoCode.maxDiscountKopecks)}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs">
                    <p>{formatPromoCodeDate(promoCode.startsAt)}</p>
                    <p>{formatPromoCodeDate(promoCode.endsAt)}</p>
                  </TableCell>
                  <TableCell>
                    {promoCode.usedCount} / {promoCode.reservedCount}
                  </TableCell>
                  <TableCell className="text-xs">
                    <p>Всего: {promoCode.maxUses ?? "∞"}</p>
                    <p>На пользователя: {promoCode.maxUsesPerUser ?? "∞"}</p>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      {promoCode.kind === "affiliate" ? (
                        <>
                          <Button asChild size="icon-sm" variant="outline">
                            <Link
                              aria-label={`Посмотреть применения ${promoCode.code}`}
                              href={routes.promoCode(promoCode.id)}
                            >
                              <Eye aria-hidden="true" />
                            </Link>
                          </Button>
                          <Button asChild size="icon-sm">
                            <Link
                              aria-label="Открыть партнёров"
                              href={routes.partners}
                            >
                              <UsersRound aria-hidden="true" />
                            </Link>
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            aria-label={
                              promoCode.isActive
                                ? "Поставить на паузу"
                                : "Включить"
                            }
                            disabled={isToggling}
                            onClick={() =>
                              updatePromoCode({
                                input: getTogglePromoCodeInput(
                                  promoCode,
                                  !promoCode.isActive,
                                ),
                                promoCodeId: promoCode.id,
                              })
                            }
                            size="icon-sm"
                            type="button"
                            variant="outline"
                          >
                            {promoCode.isActive ? (
                              <Pause aria-hidden="true" />
                            ) : (
                              <Play aria-hidden="true" />
                            )}
                          </Button>
                          <Button asChild size="icon-sm">
                            <Link
                              aria-label={`Редактировать ${promoCode.code}`}
                              href={routes.promoCode(promoCode.id)}
                            >
                              <Pencil aria-hidden="true" />
                            </Link>
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
