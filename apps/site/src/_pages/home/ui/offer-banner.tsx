import Image from "next/image";
import Link from "next/link";
import { HomeOffer } from "@/features/home-offer";
import { cn } from "@/shared/lib";
import { homeLinks } from "./constants";
import styles from "./home.module.css";

export function OfferBanner() {
  return (
    <section
      className={cn("container", styles.fluidContainer, styles.offerSection)}
      aria-label="Скидка на раскраски"
    >
      <Link
        href={homeLinks.albums}
        aria-label="Выбрать раскраску в каталоге"
        className={cn(
          styles.campaign,
          "relative block overflow-hidden rounded-3xl outline-offset-4 focus-visible:outline-2 focus-visible:outline-rose-400",
        )}
      >
        <span aria-hidden="true" className={styles.campaignShade} />
        <div className={styles.campaignCopy}>
          <HomeOffer />
        </div>
        <div className={styles.campaignArt}>
          <Image
            src="/home/cats-glasses-banner.webp"
            alt="Кот в очках из альбома Artmate «Котики 2»"
            width={1500}
            height={1100}
            loading="eager"
            sizes="(min-width: 1536px) 1324px, calc(88vw - 28px)"
            className={styles.campaignImage}
          />
        </div>
      </Link>
    </section>
  );
}
