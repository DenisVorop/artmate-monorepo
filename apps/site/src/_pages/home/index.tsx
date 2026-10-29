import { HomeProducts } from "@/features/home-products";
import { HomeCompanion } from "@/features/home-companion";
import { HomeCommunity } from "@/features/home-community";
import { Hero } from "./ui/hero";
import { OfferBanner } from "./ui/offer-banner";
import { Collections } from "./ui/collections";
import { Benefits } from "./ui/benefits";
import { ShoppingInfo } from "./ui/shopping-info";
import { Reviews } from "./ui/reviews";
import styles from "./ui/home.module.css";

export function HomePage() {
  return (
    <main className={`${styles.page} flex flex-col overflow-x-clip text-stone-900`}>
      <Hero />
      <OfferBanner />
      <Collections />
      <HomeProducts className={styles.panel} />
      <Benefits />
      <HomeCompanion className={styles.panel} />
      <HomeCommunity className={styles.panel} />
      <Reviews className={`${styles.panel} ${styles.reviewsPanel}`} />
      <div className={styles.panel}>
        <ShoppingInfo />
      </div>
    </main>
  );
}
