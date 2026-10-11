import type { Cart } from "@/entities/cart";
import type { LoyaltyOverview } from "@/entities/loyalty";
import type { CheckoutCalculationDTO } from "@/shared/actions/orders";

export const previewCart: Cart = {
  id: "checkout-preview",
  currency: "RUB",
  itemsCount: 2,
  subtotal: 1398,
  total: 1398,
  isOzonDeliveryAvailable: true,
  minimumDeliveryPrices: { ozon: 100 },
  items: [
    {
      id: "preview-album",
      title: "Раскраска по номерам, 25 картин",
      slug: "preview-album",
      image: "/previews/coloring-palette/album-product-256.webp",
      price: 699,
      originalPrice: 799,
      quantity: 2,
      lineTotal: 1398,
    },
  ],
};

export const previewLoyalty: LoyaltyOverview = {
  enrolled: true,
  termsVersion: "loyalty-v1",
  member: {
    id: "preview-member",
    joinedAt: "2026-10-01T10:00:00Z",
    termsVersion: "loyalty-v1",
    status: "active",
    historyState: "ready",
    wallet: { availablePoints: 1250, balancePoints: 1250, reservedPoints: 0, revision: 1 },
  },
};

export function createPreviewCalculation(
  points: number,
  hasPromo: boolean,
): CheckoutCalculationDTO {
  const promoDiscountKopecks = hasPromo ? 13980 : 0;
  const pointsDiscountKopecks = points * 20;
  return {
    cartId: previewCart.id,
    itemsCount: previewCart.itemsCount,
    subtotal: previewCart.subtotal,
    discount: (promoDiscountKopecks + pointsDiscountKopecks) / 100,
    promoCode: hasPromo ? "ART10" : undefined,
    currency: "RUB",
    deliveryPrice: 100,
    total: (139800 - promoDiscountKopecks - pointsDiscountKopecks + 10000) / 100,
    loyalty: {
      availablePoints: 1250,
      maxPoints: 1250,
      pointsToSpend: points,
      discountKopecks: pointsDiscountKopecks,
      expectedEarnedPoints: points === 0 ? 300 : 0,
      pricingRevision: "preview",
    },
    delivery: {
      provider: "ozon",
      pickupPoint: {
        id: "preview-pickup",
        title: "Пункт выдачи Ozon",
        address: "Москва, ул. Большая Полянка, 28",
        workHours: "Ежедневно, 10:00–21:00",
        deliveryPrice: 100,
      },
    },
    estimatedDeliveryDateRange: { min: "2026-10-14", max: "2026-10-16" },
  };
}
