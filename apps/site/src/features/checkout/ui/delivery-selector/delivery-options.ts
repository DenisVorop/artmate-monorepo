import { Package, Store, Truck } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type DeliveryCompanyCode = "cdek" | "ozon" | "wildberries";

export type DeliveryCompanyOption = {
  accentClassName: string;
  code: DeliveryCompanyCode;
  icon: LucideIcon;
  isEnabled: boolean;
  label: string;
};

export const deliveryCompanies: DeliveryCompanyOption[] = [
  {
    accentClassName: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    code: "cdek",
    icon: Truck,
    isEnabled: true,
    label: "СДЭК",
  },
  {
    accentClassName: "bg-blue-50 text-blue-700 ring-blue-200",
    code: "ozon",
    icon: Package,
    isEnabled: false,
    label: "Ozon",
  },
  {
    accentClassName: "bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-200",
    code: "wildberries",
    icon: Store,
    isEnabled: false,
    label: "Wildberries",
  },
];

export const defaultDeliveryCompany = deliveryCompanies.find((company) => company.isEnabled)?.code;
