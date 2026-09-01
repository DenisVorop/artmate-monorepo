"use client";

import type { ReactNode } from "react";
import { AlertTriangle, CalendarDays, ShoppingBag } from "lucide-react";

import {
  authorMaterialsWarning,
  CommunityWorkCard,
  CommunityWorkMaterials,
  PublicAssetImage,
  useCommunityWorks,
  usePublicCommunityWork,
} from "@/entities/community-work";
import { routes } from "@/shared/constants";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  DataState,
} from "@/shared/ui";
import { Link } from "@/shared/ui/link";
import { PageTitle } from "@/shared/ui/typography";

import { ShareWorkButton } from "./share-button";

export function PublicWorkView({
  publicId,
  renderReportAction,
}: {
  publicId: string;
  renderReportAction?: (_revisionId: string) => ReactNode;
}) {
  const query = usePublicCommunityWork(publicId);

  if (query.isPending) {
    return (
      <DataState title="Загружаем работу" description="Подготавливаем фото и данные автора." />
    );
  }

  if (query.isError || !query.work) {
    return (
      <div className="space-y-4">
        <DataState
          variant="error"
          title="Не удалось загрузить работу"
          description="Проверьте соединение и попробуйте ещё раз."
        />
        <div className="flex justify-center">
          <Button type="button" className="min-h-11" onClick={() => void query.refetch()}>
            Повторить
          </Button>
        </div>
      </div>
    );
  }

  return <PublicWorkContent work={query.work} renderReportAction={renderReportAction} />;
}

function PublicWorkContent({
  work,
  renderReportAction,
}: {
  work: NonNullable<ReturnType<typeof usePublicCommunityWork>["work"]>;
  renderReportAction?: (_revisionId: string) => ReactNode;
}) {
  const related = useCommunityWorks(work.official.collection.slug, work.official.coloring.number);
  const otherWorks = related.works.filter((item) => item.publicId !== work.publicId);

  return (
    <article className="space-y-8">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href={routes.home}>Главная</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href={routes.publicWorkshop(work.author.handle)}>
                Мастерская {work.author.name}
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{work.official.coloring.title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <header className="space-y-5">
        <PageTitle>{work.official.coloring.title}</PageTitle>
        <div className="grid gap-4 rounded-2xl border border-rose-100 bg-rose-50/50 p-4 lg:grid-cols-[auto_1fr_minmax(18rem,36rem)] lg:items-center">
          <Avatar className="size-14">
            {work.author.image ? (
              <AvatarImage src={work.author.image} alt={`Аватар ${work.author.name}`} />
            ) : null}
            <AvatarFallback>{work.author.name.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div>
            <Link
              href={routes.publicWorkshop(work.author.handle)}
              className="font-bold text-stone-900 underline-offset-4 hover:underline"
            >
              {work.author.name}
            </Link>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-stone-500">
              <CalendarDays className="size-4" aria-hidden="true" />
              {formatDate(work.submission.publishedAt)}
            </p>
          </div>
          <aside className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-950">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <p>{authorMaterialsWarning}</p>
          </aside>
        </div>
      </header>

      <section
        aria-label="Фотография работы"
        className="relative mx-auto aspect-[4/5] w-full max-w-4xl overflow-hidden rounded-3xl bg-stone-100 shadow-sm ring-1 ring-stone-200"
      >
        <PublicAssetImage
          publicId={work.publicId}
          variant="web"
          priority
          alt={`Готовая работа «${work.official.coloring.title}» автора ${work.author.name}`}
          className="object-contain"
        />
      </section>

      {work.submission.caption ? (
        <section aria-labelledby="work-caption-heading" className="mx-auto max-w-3xl">
          <h2 id="work-caption-heading" className="text-xl font-bold">
            Подпись автора
          </h2>
          <p className="mt-3 text-lg leading-8 whitespace-pre-wrap text-stone-700">
            {work.submission.caption}
          </p>
        </section>
      ) : null}

      <section className="mx-auto max-w-3xl">
        <CommunityWorkMaterials work={work} />
      </section>

      <section className="mx-auto grid max-w-3xl gap-4 rounded-2xl border p-5 sm:grid-cols-2 sm:p-6">
        <div>
          <h2 className="text-xl font-bold">Официальная цифровая версия</h2>
          <p className="mt-2 text-sm text-stone-600">
            Сравните работу с официальной палитрой и цветной версией Artmate.
          </p>
          <Button asChild variant="outline" className="mt-4 min-h-11">
            <Link
              href={routes.coloring(work.official.collection.slug, work.official.coloring.number)}
            >
              Открыть картину
            </Link>
          </Button>
        </div>
        {work.relatedProduct ? (
          <div className="rounded-xl bg-gradient-to-br from-rose-50 to-orange-50 p-4">
            <h2 className="text-xl font-bold">Раскрасить на бумаге</h2>
            <p className="mt-2 text-sm text-stone-600">{work.relatedProduct.title}</p>
            <Button asChild className="mt-4 min-h-11">
              <Link
                href={routes.product(work.relatedProduct.categorySlug, work.relatedProduct.slug)}
              >
                <ShoppingBag data-icon="inline-start" />К альбому
              </Link>
            </Button>
          </div>
        ) : null}
      </section>

      <section aria-labelledby="other-works-heading">
        <h2 id="other-works-heading" className="mb-4 text-2xl font-bold">
          Другие работы по этой картине
        </h2>
        {related.isPending ? (
          <DataState title="Загружаем работы" description="Ищем другие опубликованные версии." />
        ) : related.isError ? (
          <DataState
            variant="error"
            title="Не удалось загрузить другие работы"
            description="Основная работа доступна; этот блок можно обновить позже."
          />
        ) : otherWorks.length > 0 ? (
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {otherWorks.map((item) => (
              <li key={item.publicId}>
                <CommunityWorkCard work={item} />
              </li>
            ))}
          </ul>
        ) : (
          <DataState
            title="Других работ пока нет"
            description="Это первая опубликованная работа по этой картине."
            className="max-w-none"
          />
        )}
      </section>

      <footer className="flex flex-col justify-between gap-3 border-t pt-6 sm:flex-row sm:items-center">
        <ShareWorkButton title={`${work.official.coloring.title} · ${work.author.name}`} />
        {renderReportAction?.(work.revisionId)}
      </footer>
    </article>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}
