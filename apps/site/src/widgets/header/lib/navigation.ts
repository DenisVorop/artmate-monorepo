import { routes } from "@/shared/constants";

const items = {
  catalog: { href: routes.catalog, title: "Каталог" },
  colorings: { href: routes.colorings, title: "Цифровые версии" },
  blog: { href: routes.blog, title: "Блог" },
  delivery: { href: routes.paymentAndDelivery, title: "Оплата и доставка" },
  contacts: { href: routes.contacts, title: "Контакты" },
  faq: { href: routes.faq, title: "Вопросы и ответы" },
};

export const mainNavItems = [items.catalog, items.colorings, items.blog];
export const helpNavItems = [items.delivery, items.contacts, items.faq];
export const desktopNavItems = [items.colorings, items.delivery, items.blog];
export const desktopHelpItems = [items.contacts, items.faq];

export function isRouteActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
