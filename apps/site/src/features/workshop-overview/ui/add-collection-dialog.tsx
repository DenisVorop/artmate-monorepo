"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { Controller, useForm } from "react-hook-form";

import { useColoringCollectionsData } from "@/entities/coloring-collection";
import type { OwnerWorkshop } from "@/entities/workshop";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui";

import { addCollectionFormSchema, type AddCollectionFormValues } from "../lib";
import { useAddWorkshopCollection } from "../model";

export function AddCollectionDialog({ workshop }: { workshop: OwnerWorkshop }) {
  const [isOpen, setIsOpen] = useState(false);
  const [serverError, setServerError] = useState<string>();
  const { collections = [], isError, isPending } = useColoringCollectionsData();
  const availableCollections = collections.filter(
    (collection) => !workshop.collections.some((item) => item.slug === collection.slug),
  );
  const {
    control,
    formState: { errors },
    handleSubmit,
    reset,
  } = useForm<AddCollectionFormValues>({
    resolver: zodResolver(addCollectionFormSchema),
    defaultValues: { collectionSlug: "" },
  });
  const addCollection = useAddWorkshopCollection({
    onSuccess: () => {
      reset();
      setIsOpen(false);
    },
  });

  async function onSubmit(values: AddCollectionFormValues) {
    setServerError(undefined);

    try {
      await addCollection.mutate(values.collectionSlug);
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Не удалось добавить тематику");
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button type="button" className="min-h-11">
          <Plus data-icon="inline-start" />
          Добавить тематику
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Добавить тематику</DialogTitle>
          <DialogDescription>
            Выберите официальную коллекцию Artmate. Все её картины появятся в мастерской.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            void handleSubmit(onSubmit)(event);
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="workshop-collection">Тематика</Label>
            <Controller
              name="collectionSlug"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange} disabled={isPending}>
                  <SelectTrigger
                    id="workshop-collection"
                    size="lg"
                    className="w-full"
                    aria-invalid={Boolean(errors.collectionSlug)}
                  >
                    <SelectValue placeholder="Выберите коллекцию" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCollections.map((collection) => (
                      <SelectItem key={collection.slug} value={collection.slug}>
                        {collection.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.collectionSlug?.message ? (
              <p className="text-sm text-destructive">{errors.collectionSlug.message}</p>
            ) : null}
            {isError ? (
              <p className="text-sm text-destructive">Не удалось загрузить список тематик.</p>
            ) : null}
            {!isPending && !isError && availableCollections.length === 0 ? (
              <p className="text-sm text-stone-500">Все доступные тематики уже добавлены.</p>
            ) : null}
            {serverError ? <p className="text-sm text-destructive">{serverError}</p> : null}
          </div>
          <DialogFooter>
            <Button
              type="submit"
              className="min-h-11"
              disabled={addCollection.isPending || availableCollections.length === 0}
            >
              Добавить
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
