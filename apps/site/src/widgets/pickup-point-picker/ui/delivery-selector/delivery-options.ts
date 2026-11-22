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
];

export const defaultDeliveryCompany: DeliveryCompanyCode = "ozon";
