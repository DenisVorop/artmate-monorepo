"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";

import { useSession } from "@/entities/session";
import { routes } from "@/shared/constants";
import { Button } from "@/shared/ui";

import { useAddCollection } from "../model/use-add-collection";

export function AddWorkshopCollectionButton({ slug }: { slug: string }) {
  const router = useRouter();
  const { user, isPending: isSessionPending } = useSession();
  const [error, setError] = useState<string>();
  const addCollection = useAddCollection();

  async function add() {
    const next = routes.digitalCollection(slug);

    if (!user) {
      router.push(`${routes.auth}?next=${encodeURIComponent(next)}`);
      return;
    }

    setError(undefined);

    try {
      await addCollection.mutate(slug);
      router.push(routes.workshopCollection(slug));
    } catch (mutationError) {
      setError(
        mutationError instanceof Error ? mutationError.message : "Не удалось добавить тематику",
      );
    }
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="min-h-11 border-rose-200 text-rose-700"
        disabled={isSessionPending || addCollection.isPending}
        onClick={() => void add()}
      >
        <Plus data-icon="inline-start" />
        Добавить в мастерскую
      </Button>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
