import Image from "next/image";
import Link from "next/link";
import { cn } from "@/shared/lib";
import { homeLinks } from "./constants";
import styles from "./home.module.css";

const collections = [
  {
    title: "Хиты продаж",
    href: `${homeLinks.albums}&hits=1`,
    tone: styles.peach,
    icon: "/home/collection-hits.webp",
  },
  {
    title: "Новинки",
    href: `${homeLinks.albums}&sort=newest`,
    tone: styles.lavender,
    icon: "/home/collection-new.webp",
  },
  {
    title: "Пиксельные",
    href: `${homeLinks.albums}&tags=pikselnye`,
    tone: styles.pink,
    icon: "/home/collection-pixel.webp",
  },
  {
    title: "Антистресс",
    href: `${homeLinks.albums}&tags=antistress`,
    tone: styles.lilac,
    icon: "/home/collection-antistress.webp",
  },
] as const;

export function Collections() {
  return (
    <nav
      className={cn("container", styles.fluidContainer, styles.collectionSection)}
      aria-label="Подборки раскрасок"
    >
      <ul
        className={cn(
          "flex snap-x snap-mandatory gap-3 overflow-x-auto lg:grid lg:grid-cols-4",
          styles.collectionList,
        )}
      >
        {collections.map((collection) => (
          <li
            key={collection.title}
            className="max-w-36 min-w-0 shrink-0 basis-[34%] snap-start sm:max-w-none sm:basis-[38%] lg:basis-auto"
          >
            <Link
              href={collection.href}
              className={cn(
                "group relative block overflow-hidden rounded-2xl focus-visible:outline-2 focus-visible:outline-rose-400 sm:rounded-[28px]",
                styles.collectionCard,
                collection.tone,
              )}
            >
              <span className={styles.collectionTitle}>{collection.title}</span>
              <span className={styles.collectionSticker} aria-hidden="true">
                <Image
                  src={collection.icon}
                  alt=""
                  width={400}
                  height={400}
                  sizes="(min-width: 640px) 116px, 80px"
                  className="h-full w-full object-contain"
                />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
