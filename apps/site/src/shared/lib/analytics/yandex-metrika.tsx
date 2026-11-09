import { Suspense } from "react";
import Script from "next/script";

import { YandexAttributionInitializer } from "./yandex-attribution-initializer";
import { YandexMetrikaInitializer } from "./yandex-metrika-initializer";
import { YandexMetrikaPageView } from "./yandex-metrika-page-view";

export function YandexMetrika() {
  const counterId = getCounterId();

  if (!counterId) {
    return null;
  }

  return (
    <>
      <span hidden id="yandex-metrika" data-counter-id={counterId} />
      <Script
        id="yandex-metrika-script"
        src={`https://mc.yandex.ru/metrika/tag.js?id=${counterId}`}
        strategy="lazyOnload"
      />
      <noscript>
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://mc.yandex.ru/watch/${counterId}`}
            style={{ position: "absolute", left: "-9999px" }}
            alt=""
          />
        </div>
      </noscript>
      <YandexMetrikaInitializer counterId={counterId} />
      <YandexAttributionInitializer counterId={counterId} />
      <Suspense fallback={null}>
        <YandexMetrikaPageView counterId={counterId} />
      </Suspense>
    </>
  );
}

function getCounterId() {
  const rawCounterId = process.env.YANDEX_METRIKA_ID ?? process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID;

  if (!rawCounterId) {
    return null;
  }

  const counterId = Number(rawCounterId);

  if (!Number.isInteger(counterId) || counterId <= 0) {
    return null;
  }

  return counterId;
}
