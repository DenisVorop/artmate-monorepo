"use client";
import { usePromocode } from "../lib/promo-code-provider";
import {
  personalPromoAvailability,
  personalPromoDate,
  personalPromoDiscount,
  personalPromoMoney,
  type PersonalPromoCode,
} from "../lib/personal-promocodes";

export function PromoCodeConditions({ code }: { code: PersonalPromoCode }) {
  const { subtotal } = usePromocode();
  const { missing } = personalPromoAvailability(code, subtotal);
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <h3 className="font-heading text-xl font-bold">Скидка {personalPromoDiscount(code)}</h3>
        <p className="text-sm leading-6 text-stone-500">{code.title}</p>
      </div>
      <dl className="space-y-4 text-sm">
        {code.minSubtotal > 0 && (
          <div className="space-y-1">
            <dt className="text-stone-500">Сумма товаров</dt>
            <dd className="font-medium">От {personalPromoMoney(code.minSubtotal)}</dd>
          </div>
        )}
        {code.maxDiscount !== null && (
          <div className="space-y-1">
            <dt className="text-stone-500">Максимальная скидка</dt>
            <dd className="font-medium">{personalPromoMoney(code.maxDiscount)}</dd>
          </div>
        )}
        {code.startsAt && (
          <div className="space-y-1">
            <dt className="text-stone-500">Действует с</dt>
            <dd className="font-medium">{personalPromoDate(code.startsAt)} МСК</dd>
          </div>
        )}
        {code.endsAt && (
          <div className="space-y-1">
            <dt className="text-stone-500">Действует до</dt>
            <dd className="font-medium">{personalPromoDate(code.endsAt)} МСК</dd>
          </div>
        )}
        <div className="space-y-1">
          <dt className="text-stone-500">Использование</dt>
          <dd className="font-medium">Один раз</dd>
        </div>
      </dl>
      {missing > 0 && (
        <p className="rounded-xl bg-stone-50 p-3 text-sm leading-6">
          Добавьте товаров ещё на {personalPromoMoney(missing)}
        </p>
      )}
      <div className="space-y-2 text-sm leading-6 text-stone-500">
        <p>Один промокод на заказ.</p>
        <p>Скидка не распространяется на доставку.</p>
      </div>
    </div>
  );
}
