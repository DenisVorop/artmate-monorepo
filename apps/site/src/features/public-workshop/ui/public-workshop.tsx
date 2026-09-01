"use client";

import { Palette } from "lucide-react";

import { CommunityWorkCard, usePublicWorkshop } from "@/entities/community-work";
import { Avatar, AvatarFallback, AvatarImage, Button, DataState } from "@/shared/ui";
import { PageTitle } from "@/shared/ui/typography";

export function PublicWorkshopView({ handle }: { handle: string }) {
  const { workshop, isError, isPending, refetch } = usePublicWorkshop(handle);

  if (isPending) {
    return (
      <DataState title="Открываем мастерскую" description="Загружаем опубликованные работы." />
    );
  }

  if (isError || !workshop) {
    return (
      <div className="space-y-4">
        <DataState
          variant="error"
          title="Не удалось открыть мастерскую"
          description="Проверьте соединение и попробуйте ещё раз."
        />
        <div className="flex justify-center">
          <Button type="button" className="min-h-11" onClick={() => void refetch()}>
            Повторить
          </Button>
        </div>
      </div>
    );
  }

  const collections = Array.from(
    workshop.works
      .reduce<
        Map<
          string,
          {
            slug: string;
            title: string;
            works: typeof workshop.works;
          }
        >
      >((groups, work) => {
        const collection = work.official.collection;
        const group = groups.get(collection.slug) ?? {
          slug: collection.slug,
          title: collection.title,
          works: [],
        };
        group.works.push(work);
        groups.set(collection.slug, group);
        return groups;
      }, new Map())
      .values(),
  );
  const workCount = workshop.works.length;

  return (
    <div className="space-y-10">
      <header className="rounded-3xl border border-rose-100 bg-gradient-to-br from-rose-50 via-white to-orange-50 p-5 sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <Avatar className="size-20 ring-4 ring-white sm:size-24">
            {workshop.author.image ? (
              <AvatarImage src={workshop.author.image} alt={`Аватар ${workshop.author.name}`} />
            ) : null}
            <AvatarFallback>{workshop.author.name.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="space-y-2">
            <p className="flex items-center gap-2 text-sm font-bold tracking-wide text-rose-500 uppercase">
              <Palette className="size-4" aria-hidden="true" />
              Мастерская · {workCount} работ
            </p>
            <PageTitle>{workshop.author.name}</PageTitle>
            <p className="text-stone-500">@{workshop.handle}</p>
          </div>
        </div>
      </header>

      {workCount === 0 ? (
        <DataState
          title="Публичных работ пока нет"
          description="Автор ещё не опубликовал одобренные работы."
          className="max-w-none"
        />
      ) : (
        collections.map((collection) =>
          collection.works.length > 0 ? (
            <section key={collection.slug} aria-labelledby={`collection-${collection.slug}`}>
              <h2 id={`collection-${collection.slug}`} className="mb-4 text-2xl font-bold">
                {collection.title}
              </h2>
              <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {collection.works.map((work) => (
                  <li key={work.publicId}>
                    <CommunityWorkCard work={work} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null,
        )
      )}
    </div>
  );
}
