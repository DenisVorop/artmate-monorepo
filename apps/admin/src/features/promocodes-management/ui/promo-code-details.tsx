"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useEffect } from "react";
import { useForm } from "react-hook-form";

import { formatPromoCodeDate, usePromoCode } from "@/entities/promocodes";
import { routes } from "@/shared/constants";
import {
  Badge,
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

import {
  createPromoCodeDefaultValues,
  getPromoCodeDefaultValues,
  getUpdatePromoCodeInput,
  promoCodeFormSchema,
  type PromoCodeFormValues,
} from "../lib";
import { useUpdatePromoCode } from "../model";
import { PromoCodeForm } from "./promo-code-form";
import { ReleasePromoCodeRedemption } from "./release-promo-code-redemption";

const usageLabels = {
  released: "Освобождён",
  reserved: "Зарезервирован",
  used: "Использован",
} as const;

export function PromoCodeDetails({
  promoCodeId,
}: {
  readonly promoCodeId: string;
}) {
  const { isError, isPending, promoCode } = usePromoCode(promoCodeId);
  const form = useForm<PromoCodeFormValues>({
    defaultValues: promoCode
      ? getPromoCodeDefaultValues(promoCode)
      : createPromoCodeDefaultValues,
    resolver: zodResolver(promoCodeFormSchema),
  });
  const isFormDirty = form.formState.isDirty;
  const { isPending: isUpdating, mutate: updatePromoCode } = useUpdatePromoCode(
    {
      onSuccess: (updatedPromoCode) => {
        form.reset(getPromoCodeDefaultValues(updatedPromoCode));
      },
    },
  );

  useEffect(() => {
    if (promoCode && !isFormDirty) {
      form.reset(getPromoCodeDefaultValues(promoCode));
    }
  }, [form, isFormDirty, promoCode]);

  if (isError || isPending || !promoCode) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            {isError ? "Не удалось загрузить промокод" : "Загрузка промокода"}
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{promoCode.code}</CardTitle>
        </CardHeader>
        <CardContent>
          <PromoCodeForm
            codeImmutable
            form={form}
            formId={`promo-code-${promoCode.id}`}
            onSubmit={form.handleSubmit((values) =>
              updatePromoCode({
                input: getUpdatePromoCodeInput(values, promoCode),
                promoCodeId: promoCode.id,
              }),
            )}
            submitLabel="Сохранить"
            submitPending={isUpdating}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Применения</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {promoCode.usages?.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Заказ</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Создано</TableHead>
                  <TableHead>Использовано</TableHead>
                  <TableHead className="text-right">Действие</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {promoCode.usages.map((usage) => (
                  <TableRow key={`${usage.orderId}-${usage.createdAt}`}>
                    <TableCell>
                      <Link
                        className="font-medium underline-offset-4 hover:underline"
                        href={routes.order(usage.orderId)}
                      >
                        {usage.orderId}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {usageLabels[usage.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {formatPromoCodeDate(usage.createdAt)}
                    </TableCell>
                    <TableCell>
                      {usage.usedAt
                        ? formatPromoCodeDate(usage.usedAt)
                        : "Не использован"}
                    </TableCell>
                    <TableCell className="text-right">
                      {usage.status === "reserved" ? (
                        <ReleasePromoCodeRedemption
                          orderId={usage.orderId}
                          promoCodeId={promoCode.id}
                        />
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">
              Применений пока нет.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
