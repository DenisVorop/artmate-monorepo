import { routes } from "@/shared/constants";
import {
  createAnalytics,
  createGoalCommand,
  siteActions,
  siteAreas,
  type YandexGoalParams,
} from "@/shared/lib/analytics";
import { isSensitivePath } from "@/shared/lib/is-sensitive-path";

type NavigationParams = YandexGoalParams["site_navigation"];
type InteractionParams = YandexGoalParams["site_interaction"];
type ScrollParams = YandexGoalParams["site_scroll_depth"];

export const siteAnalytics = createAnalytics({
  navigation: (params: NavigationParams) => createGoalCommand("site_navigation", params),
  scroll: (params: ScrollParams) => createGoalCommand("site_scroll_depth", params),
  interaction: (params: InteractionParams) => createGoalCommand("site_interaction", params),

});

const sections = [
  [routes.workshop, "club"],
  [routes.account, "account"],
  [routes.checkout, "checkout"],
  [routes.catalog, "catalog"],
  [routes.colorings, "digital"],
  [routes.gallery, "gallery"],
  ["/club", "club"],
  [routes.cart, "cart"],
  [routes.auth, "auth"],
  [routes.legal.index, "legal"],
  [routes.contacts, "help"],
  [routes.faq, "help"],
  [routes.paymentAndDelivery, "help"],
  [routes.partners, "partners"],
  [routes.wholesale, "wholesale"],
] as const;

export function getSiteSection(pathname: string): InteractionParams["section"] | undefined {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (isSensitivePath(path)) return;
  if (path === routes.home) return "home";
  if (path === routes.blog) return "blog";
  if (path.startsWith(`${routes.blog}/`)) return "article";
  if (/^\/catalog\/(?:markery\/[^/]+|raskraski\/[^/]+\/[^/]+)$/.test(path)) {
    return "product";
  }
  return sections.find(([prefix]) => path === prefix || path.startsWith(`${prefix}/`))?.[1];
}

export function getNavigationDestination(href: string, current: Location, isProduct: boolean) {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return;
  }
  if (url.origin === current.origin) {
    if (url.pathname === current.pathname && url.search === current.search) return;
    return isProduct ? "product" : getSiteSection(url.pathname);
  }
  if (url.protocol !== "https:") return;
  const host = url.hostname.replace(/^www\./, "");
  if (host === "ozon.ru" || host === "ozon.com") return "marketplace_ozon";
  if (host === "wildberries.ru") return "marketplace_wildberries";
  if (host === "t.me") return "telegram";
}

export function getSiteArea(value: string | null | undefined) {
  return siteAreas.find((area) => area === value) ?? "content";
}

export function getSiteAction(value: string | null | undefined) {
  return siteActions.find((action) => action === value);
}
