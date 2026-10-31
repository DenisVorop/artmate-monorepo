import { Plus } from "lucide-react";

import { CommunityGallery, GalleryAlbums } from "@/features/community-gallery";
import { routes } from "@/shared/constants";
import { Button, CtaGradientLink, PageHero } from "@/shared/ui";
import { About } from "./ui/about";
import { Faq } from "./ui/faq";

export function GalleryPage({
  initialCollectionSlug,
  collectionTitle,
}: {
  initialCollectionSlug?: string;
  collectionTitle?: string;
}) {
  return (
    <main className="bg-stone-100/80 text-stone-900">
      <div className="container max-w-[1500px] space-y-7 py-5 md:space-y-9 md:py-8">
        <PageHero
          breadcrumbs={[
            { label: "Главная", href: routes.home },
            { label: "Галерея", ...(collectionTitle ? { href: routes.gallery } : {}) },
            ...(collectionTitle ? [{ label: collectionTitle }] : []),
          ]}
          title={collectionTitle ? `Раскраска по номерам «${collectionTitle}»` : "Галерея работ"}
          description={
            collectionTitle ? (
              `Работы участников из альбома «${collectionTitle}». Рассмотрите готовые картинки и выберите, какую раскрасить следующей.`
            ) : (
              <>
                Готовые раскраски Artmate от наших участников. Посмотрите, как один и&nbsp;тот же
                сюжет получается у&nbsp;разных людей, и&nbsp;покажите свою работу.
              </>
            )
          }
          actions={
            <Button
              asChild
              size="lg"
              className="min-h-11 border-0 bg-gradient-to-r from-rose-500 via-rose-400 to-orange-400 px-5 font-semibold text-white shadow-sm shadow-rose-500/20 hover:from-rose-500/95 hover:via-rose-400/95 hover:to-orange-400/95"
            >
              <CtaGradientLink href={routes.workshop}>
                <Plus />
                Поделиться работой
              </CtaGradientLink>
            </Button>
          }
        />
        <CommunityGallery initialCollectionSlug={initialCollectionSlug} />
        <div className="space-y-10 pb-6 md:space-y-14 md:pb-10">
          <About collectionSlug={initialCollectionSlug} collectionTitle={collectionTitle} />
          <GalleryAlbums collectionSlug={initialCollectionSlug} />
          <Faq collectionSlug={initialCollectionSlug} />
        </div>
      </div>
    </main>
  );
}
