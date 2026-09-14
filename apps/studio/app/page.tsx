import type { Metadata } from "next";
import { StudioPage } from "@/pages/studio/ui/page";
export const metadata: Metadata = {
  title: "Artmate Studio — раскраски по номерам",
  description:
    "Из изображения в готовую раскраску: контуры, палитра и обозначения.",
  robots: { index: false, follow: false },
};
export default function Page() {
  return <StudioPage />;
}
