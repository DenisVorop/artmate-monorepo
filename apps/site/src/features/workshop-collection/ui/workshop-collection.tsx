"use client";

import { useState } from "react";

import {
  WorkshopColoringCard,
  type WorkshopWork,
  useWorkshopCollectionData,
} from "@/entities/workshop";
import { routes } from "@/shared/constants";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  DataState,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui";
import { Link } from "@/shared/ui/link";
import { PageTitle } from "@/shared/ui/typography";

import { useDeleteWorkshopWork, usePublishWorkshopWork, useUnpublishWorkshopWork } from "../model";

type PendingAction = {
  kind: "publish" | "unpublish" | "delete";
  work: WorkshopWork;
};

export function WorkshopCollection({ slug }: { slug: string }) {
  const { collection, isError, isPending, refetch } = useWorkshopCollectionData(slug);
  const [pendingAction, setPendingAction] = useState<PendingAction>();
  const [actionError, setActionError] = useState<string>();
  const closeDialog = () => setPendingAction(undefined);
  const publishWork = usePublishWorkshopWork({ onSuccess: closeDialog });
  const unpublishWork = useUnpublishWorkshopWork({ onSuccess: closeDialog });
  const deleteWork = useDeleteWorkshopWork({ onSuccess: closeDialog });
  const isMutating = publishWork.isPending || unpublishWork.isPending || deleteWork.isPending;

  if (isPending) {
    return (
      <DataState title="Загружаем тематику" description="Собираем все картины и ваши работы." />
    );
  }

  if (isError || !collection) {
    return (
      <div className="space-y-4">
        <DataState
          variant="error"
          title="Не удалось открыть тематику"
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

  async function confirmAction() {
    if (!pendingAction) return;
    setActionError(undefined);

    try {
      if (pendingAction.kind === "publish") await publishWork.mutate(pendingAction.work.id);
      if (pendingAction.kind === "unpublish") await unpublishWork.mutate(pendingAction.work.id);
      if (pendingAction.kind === "delete") await deleteWork.mutate(pendingAction.work.id);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Не удалось выполнить действие");
    }
  }

  return (
    <div className="space-y-8">
      <header className="space-y-5">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href={routes.workshop}>Моя мастерская</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{collection.title}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className="space-y-2">
          <PageTitle>{collection.title}</PageTitle>
          <p className="max-w-2xl text-stone-600">
            Все {collection.expectedColoringCount} официальных картин тематики. Пустые карточки
            доступны для добавления работы и не являются заблокированными.
          </p>
        </div>
      </header>

      <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {collection.colorings.map((coloring) => (
          <li key={coloring.id}>
            <WorkshopColoringCard
              collectionSlug={collection.slug}
              coloring={coloring}
              isMutating={isMutating}
              onPublish={(work) => setPendingAction({ kind: "publish", work })}
              onUnpublish={(work) => setPendingAction({ kind: "unpublish", work })}
              onDelete={(work) => setPendingAction({ kind: "delete", work })}
            />
          </li>
        ))}
      </ul>

      <Dialog
        open={Boolean(pendingAction)}
        onOpenChange={(open) => {
          if (!open && !isMutating) closeDialog();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{getActionTitle(pendingAction?.kind)}</DialogTitle>
            <DialogDescription>{getActionDescription(pendingAction?.kind)}</DialogDescription>
          </DialogHeader>
          {actionError ? <p className="text-sm text-destructive">{actionError}</p> : null}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" className="min-h-11" disabled={isMutating}>
                Отмена
              </Button>
            </DialogClose>
            <Button
              type="button"
              variant={pendingAction?.kind === "delete" ? "destructive" : "default"}
              className="min-h-11"
              disabled={isMutating}
              onClick={() => void confirmAction()}
            >
              Подтвердить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function getActionTitle(kind: PendingAction["kind"] | undefined) {
  if (kind === "publish") return "Опубликовать работу?";
  if (kind === "unpublish") return "Скрыть работу?";
  return "Удалить работу?";
}

function getActionDescription(kind: PendingAction["kind"] | undefined) {
  if (kind === "publish") return "Одобренная работа появится в вашей публичной мастерской.";
  if (kind === "unpublish") return "Работа исчезнет из публичной мастерской, но останется у вас.";
  return "Работа сразу исчезнет из мастерской и публичных страниц. Отменить удаление через интерфейс нельзя; данные останутся в закрытом служебном архиве.";
}
