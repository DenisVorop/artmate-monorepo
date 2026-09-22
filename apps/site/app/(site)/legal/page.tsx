import { LegalDirectoryPage } from "@/pages/legal";
import { routes } from "@/shared/constants";
import { createLegalMetadata, Seo } from "@/shared/lib/seo";

export function generateMetadata() {
  return Seo.getMetadata({
    path: routes.legal.index,
    fallback: createLegalMetadata({
      title: "Правовые документы",
      description:
        "Условия покупок, использования сайта и участия в клубе Artmate. Оферта, соглашения и политика конфиденциальности.",
      href: routes.legal.index,
    }),
  });
}

export default function Page() {
  return <LegalDirectoryPage />;
}
