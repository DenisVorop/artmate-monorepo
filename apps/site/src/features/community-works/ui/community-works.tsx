"use client";

import { CommunityWorkCard, useCommunityWorks } from "@/entities/community-work";
import { Button, DataState } from "@/shared/ui";

export function CommunityWorks({ slug, number }: { slug: string; number: number }) {
  const { works, isError, isPending, refetch } = useCommunityWorks(slug, number);

  return (
    <section aria-labelledby="community-works-heading" className="space-y-5">
      <div>
        <h2 id="community-works-heading" className="text-2xl font-bold">
          Работы участников
        </h2>
        <p className="mt-1 text-sm text-stone-600">
          Только текущие публичные работы, одобренные модерацией.
        </p>
      </div>

      {isPending ? (
        <DataState title="Загружаем работы" description="Ищем опубликованные фотографии." />
      ) : isError ? (
        <div className="space-y-3">
          <DataState
            variant="error"
            title="Не удалось загрузить работы"
            description="Официальная картина доступна; попробуйте обновить этот блок."
            className="max-w-none"
          />
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={() => void refetch()}
          >
            Повторить
          </Button>
        </div>
      ) : works.length > 0 ? (
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {works.map((work) => (
            <li key={work.publicId}>
              <CommunityWorkCard work={work} />
            </li>
          ))}
        </ul>
      ) : (
        <DataState
          title="Работ пока нет"
          description="Станьте первым участником, который опубликует готовую раскраску."
          className="max-w-none"
        />
      )}
    </section>
  );
}
