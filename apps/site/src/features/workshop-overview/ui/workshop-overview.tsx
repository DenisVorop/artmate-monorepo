"use client";

import { Palette } from "lucide-react";

import { WorkshopCollectionCard, useWorkshopData } from "@/entities/workshop";
import { Button, DataState } from "@/shared/ui";
import { PageTitle } from "@/shared/ui/typography";

import { AddCollectionDialog } from "./add-collection-dialog";
import { WorkshopVisibilityCard } from "./visibility-card";

export function WorkshopOverview() {
  const { workshop, isError, isPending, refetch } = useWorkshopData();

  if (isPending) {
    return (
      <DataState title="Открываем мастерскую" description="Собираем ваши коллекции и работы." />
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

  return (
    <div className="space-y-8">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="space-y-2">
          <p className="flex items-center gap-2 text-sm font-bold tracking-wide text-rose-500 uppercase">
            <Palette className="size-4" aria-hidden="true" />
            Творческий архив
          </p>
          <PageTitle>Моя мастерская</PageTitle>
          <p className="max-w-2xl text-stone-600">
            Фотографируйте готовые физические раскраски, сохраняйте материалы и делитесь выбранными
            работами после модерации.
          </p>
        </div>
        <AddCollectionDialog workshop={workshop} />
      </header>

      <WorkshopVisibilityCard workshop={workshop} />

      {workshop.collections.length > 0 ? (
        <section aria-labelledby="workshop-collections-heading">
          <h2 id="workshop-collections-heading" className="mb-4 text-2xl font-bold">
            Тематики
          </h2>
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {workshop.collections.map((collection) => (
              <li key={collection.id}>
                <WorkshopCollectionCard collection={collection} />
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <DataState
          title="Добавьте первую тематику"
          description="Выберите официальную коллекцию Artmate, чтобы начать собирать готовые работы."
          className="max-w-none"
        />
      )}
    </div>
  );
}
