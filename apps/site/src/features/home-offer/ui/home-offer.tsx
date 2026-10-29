"use client";

import { Unbounded } from "next/font/google";
import { useProductsData } from "@/entities/products";
import { hasAlbumOffer } from "../lib/has-album-offer";
import styles from "./offer.module.css";

const bannerFont = Unbounded({
  subsets: ["latin", "cyrillic"],
  weight: ["500", "600"],
  display: "swap",
});

export function HomeOffer() {
  const { data, isError } = useProductsData();
  const hasOffer = !isError && data && hasAlbumOffer(data.products, 12);

  return hasOffer ? (
    <div
      className={`${bannerFont.className} ${styles.offer}`}
      aria-label="Скидка 12% на все раскраски"
    >
      <p className={styles.title}>На все раскраски</p>
      <p className={styles.discount}>−12%</p>
    </div>
  ) : (
    <p className={`${bannerFont.className} ${styles.fallback}`}>Раскраски по номерам Artmate</p>
  );
}
