import type { Metadata } from "next";

import { UnavailablePage } from "@/pages/unavailable";

export const metadata: Metadata = { title: "Кабинет недоступен" };

export default function Page() {
  return <UnavailablePage />;
}
