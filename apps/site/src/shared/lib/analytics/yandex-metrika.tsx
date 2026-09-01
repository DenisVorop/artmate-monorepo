import { Suspense } from "react";
import Script from "next/script";

import { YandexMetrikaPageView } from "./yandex-metrika-page-view";

export function YandexMetrika() {
  const counterId = getCounterId();

  if (!counterId) {
    return null;
  }

  return (
    <>
      <Script
        id="yandex-metrika"
        data-counter-id={counterId}
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            (function(m,e,t,r,i,k,a){
              m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
              m[i].l=1*new Date();
              for (var j = 0; j < document.scripts.length; j++) {
                if (document.scripts[j].src === r) { return; }
              }
              k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
            })(window, document, 'script', 'https://mc.yandex.ru/metrika/tag.js?id=${counterId}', 'ym');

            ym(${counterId}, 'init', {
              ssr: true,
              webvisor: true,
              clickmap: true,
              ecommerce: 'dataLayer',
              referrer: document.referrer,
              url: location.href,
              accurateTrackBounce: true,
              trackLinks: true
            });
          `,
        }}
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
