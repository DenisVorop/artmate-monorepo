import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckoutPreviewPage } from "@/pages/checkout-preview";

export const metadata: Metadata = {
  title: "Предпросмотр оформления",
  robots: { index: false, follow: false },
};

export default function Page() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <CheckoutPreviewPage />;
}
