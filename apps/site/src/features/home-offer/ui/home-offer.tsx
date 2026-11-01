"use client";

import localFont from "next/font/local";
import { useProductsData } from "@/entities/products";
import { hasAlbumOffer } from "../lib/has-album-offer";
import styles from "./offer.module.css";

const bannerFont = localFont({
  src: "./assets/unbounded-discount.woff2",
  weight: "600",
  style: "normal",
  display: "swap",
});

export function HomeOffer() {
  const { data, isError } = useProductsData();
  const hasOffer = !isError && data && hasAlbumOffer(data.products, 12);

  return hasOffer ? (
    <div className={styles.offer} aria-label="Скидка 12% на все раскраски">
      <p className={styles.title}>На все раскраски</p>
      <p className={`${bannerFont.className} ${styles.discount}`}>−12%</p>
    </div>
  ) : (
    <p className={styles.fallback}>Раскраски по номерам Artmate</p>
  );
}
