import { sanitizeAnalyticsUrl } from "./sanitize-analytics-url";

// Native History API updates also reach the normal SPA page-view listeners.
// A virtual reading surface can update its URL silently when revisiting content.
export function virtualPageViewState(url: string, track: boolean) {
  return { artmateVirtualPageView: { url: sanitizeAnalyticsUrl(url), track } };
}

export function isSilentVirtualPageView(url: string) {
  if (typeof window === "undefined") return false;
  const view = window.history.state?.artmateVirtualPageView;
  return view?.url === url && view?.track === false;
}
