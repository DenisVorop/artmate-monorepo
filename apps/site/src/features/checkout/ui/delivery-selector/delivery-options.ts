import { Package } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type DeliveryCompanyCode = "cdek" | "ozon";

export type DeliveryCompanyOption = {
  accentClassName: string;
  code: DeliveryCompanyCode;
  icon: LucideIcon;
  label: string;
};

export const deliveryCompanies: DeliveryCompanyOption[] = [
  {
    accentClassName: "bg-blue-50 text-blue-700 ring-blue-200",
    code: "ozon",
    icon: Package,
    label: "Ozon",
  },
  /*
  {
    accentClassName: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    code: "cdek",
    icon: Truck,
    label: "СДЭК",
  },
  */
];

export const defaultDeliveryCompany: DeliveryCompanyCode = "ozon";
