import Image from "next/image";
import { cn } from "@/shared/lib";
import styles from "./benefits.module.css";

const benefits = [
  "Антистресс",
  "Сегментированные иллюстрации",
  "Бумага 190 г/м²",
  "Спиральный переплёт",
  "Идеально для\u00a0маркеров",
  "Расслабление",
  "Творчество",
  "Дзен",
];

const stickers = ["pinwheel", "paint-drop", "swirl", "ribbon", "paint-stroke", "sprig"];
const tones = [styles.purple, styles.pink, styles.orange, styles.yellow];

export function Benefits() {
  return (
    <section
      id="home-benefits"
      aria-label="Особенности раскрасок Artmate"
      className={cn("scroll-mt-28", styles.section)}
    >
      <ul className="sr-only">
        {benefits.map((benefit) => (
          <li key={benefit}>{benefit}</li>
        ))}
      </ul>
      <div className={styles.viewport} aria-hidden="true">
        <div className={styles.track}>
          {Array.from({ length: 4 }, (_, group) => (
            <div key={group} className={styles.group}>
              {benefits.map((benefit, index) => (
                <div key={benefit} className={styles.item}>
                  <span className={cn(styles.pill, tones[index % tones.length])}>{benefit}</span>
                  <Image
                    src={`/home/marquee/${stickers[index % stickers.length]}.webp`}
                    alt=""
                    width={180}
                    height={180}
                    sizes="(min-width: 768px) 34px, 28px"
                    className={styles.sticker}
                    draggable={false}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
