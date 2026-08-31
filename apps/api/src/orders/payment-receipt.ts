export type OrderReceiptPriceGroup = {
  quantity: number;
  totalKopecks: number;
  unitPriceKopecks: number;
};

export type OrderReceiptItemPricing = {
  id: string;
  priceGroups: OrderReceiptPriceGroup[];
};
