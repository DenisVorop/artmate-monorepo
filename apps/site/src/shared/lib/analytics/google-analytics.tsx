import { Suspense } from "react";
import Script from "next/script";

import { GoogleAnalyticsPageView } from "./google-analytics-page-view";

export function GoogleAnalytics() {
  const measurementId = getMeasurementId();

  if (!measurementId) {
    return null;
  }

  return (
    <>
      <Script
        id="google-analytics-script"
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="lazyOnload"
      />
      <Suspense fallback={null}>
        <GoogleAnalyticsPageView measurementId={measurementId} />
      </Suspense>
    </>
  );
}

function getMeasurementId() {
  const rawMeasurementId = process.env.GOOGLE_ANALYTICS_ID ?? process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID;

  if (!rawMeasurementId) {
    return null;
  }

  const measurementId = rawMeasurementId.trim();

  return measurementId || null;
}
