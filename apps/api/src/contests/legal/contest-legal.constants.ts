import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export const legalAssets = resolve(__dirname, "../../../assets/contest-legal");
export type LegalText = {
  title: string;
  lead: string;
  sections: { title: string; paragraphs: string[] }[];
};
export type CommonLegalDocument = {
  id: string;
  version: string;
  title: string;
  href: string;
  fileHref: string;
  sha256: string;
  content: LegalText;
};
export const contestLegalPacket = JSON.parse(
  readFileSync(resolve(legalAssets, "packet.json"), "utf8"),
) as { edition: string; editionDate: string; documents: CommonLegalDocument[] };
const resources = [
  {
    id: "site",
    label: "Конкурс и галерея Artmate",
    urls: [
      "https://artmate.ru/contests",
      "https://artmate.ru/gallery",
      "https://artmate.ru",
    ],
  },
  {
    id: "media",
    label: "Фотографии на сервере Artmate",
    urls: ["https://api.artmate.ru/contests/works"],
  },
  {
    id: "telegram",
    label: "Telegram Artmate",
    urls: ["https://t.me/artmate_official"],
  },
  {
    id: "ozon",
    label: "Магазин Artmate на Ozon",
    urls: ["https://www.ozon.ru/seller/artmate/"],
  },
  {
    id: "wildberries",
    label: "Магазин Artmate на Wildberries",
    urls: ["https://www.wildberries.ru/seller/320627"],
  },
] as const;
export const contestPublicationPolicy = {
  fields: [
    "photo",
    "contest",
    "album",
    "winner",
    "author",
    "caption",
    "number",
  ],
  resources,
} as const;
export const basePublicationRestriction =
  "Третьим лицам не разрешается самостоятельно использовать данные для рекламы, профилирования и обучения моделей. Использование оператором — только для целей и на ресурсах этого согласия.";
export function conditionsHref(slug: string, documentId: string) {
  return `/legal/contest-conditions/${encodeURIComponent(slug)}/${encodeURIComponent(documentId)}`;
}
