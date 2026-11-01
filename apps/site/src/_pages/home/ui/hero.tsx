import Image from "next/image";
import { ReviewRatingSummary } from "@/entities/reviews";
import { reviewsData } from "@/shared/actions/reviews/reviews.data";
import { cn } from "@/shared/lib";
import styles from "./hero.module.css";

const illustrations = [
  {
    src: "/home/landscapes.webp",
    alt: "Пейзаж из раскраски Artmate",
    className: "left-[3%] top-[14%] z-0 w-[35%] -rotate-12",
  },
  {
    src: "/home/fantasy.webp",
    alt: "Дракон из раскраски Artmate «Фэнтези»",
    className: "left-[32%] top-0 z-10 w-[36%] -rotate-2",
  },
  {
    src: "/home/flowers.webp",
    alt: "Цветы из раскраски Artmate",
    className: "right-[3%] top-[14%] z-20 w-[35%] rotate-12",
  },
];

export function Hero() {
  return (
    <section className={cn("container", styles.hero)} aria-labelledby="home-title">
      <div className={styles.layout}>
        <div className={styles.copy}>
          <h1
            id="home-title"
            className={cn("font-display font-bold tracking-tight text-stone-900", styles.heading)}
          >
            Раскраски по номерам{" "}
            <span className="bg-gradient-to-r from-rose-500 to-orange-400 bg-clip-text whitespace-nowrap text-transparent">
              Artmate
            </span>
          </h1>
          <p className={cn("text-stone-500", styles.description)}>
            Альбомы A4 для взрослых и детей. Плотная бумага, спиральный переплёт и сюжеты под любое
            настроение.
          </p>
          <ReviewRatingSummary
            stats={reviewsData.stats}
            className={cn("justify-start", styles.rating)}
          />
        </div>
        <div className={styles.visual}>
          <div aria-hidden="true" className={styles.surface} />
          <div className={styles.collage}>
            {illustrations.map(({ src, alt, className }) => (
              <Image
                key={src}
                src={src}
                alt={alt}
                width={640}
                height={898}
                loading="eager"
                sizes="(min-width: 1536px) 240px, (min-width: 601px) 16vw, calc(36vw - 25px)"
                className={`absolute rounded-lg shadow-lg shadow-stone-900/15 ${className}`}
              />
            ))}
          </div>
          <span aria-hidden="true" className={styles.spark}>
            ✦
          </span>
        </div>
      </div>
    </section>
  );
}
