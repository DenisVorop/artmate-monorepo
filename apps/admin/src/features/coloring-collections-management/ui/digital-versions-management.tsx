"use client";

import { ImageIcon, Pencil, Plus } from "lucide-react";
import Link from "next/link";

import {
  useColoringCollections,
  type ColoringCollection,
} from "@/entities/coloring-collections";
import { routes } from "@/shared/constants";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Progress,
} from "@/shared/ui";

export function DigitalVersionsManagement() {
  const { collections, isError, isPending } = useColoringCollections();

  if (isError) {
    return <StateCard title="Не удалось загрузить цифровые версии" text="Перезагрузите страницу и повторите попытку." />;
  }

  if (isPending) {
    return <StateCard title="Загрузка цифровых версий" text="Получаем коллекции и прогресс подготовки." />;
  }

  if (collections.length === 0) {
    return (
      <StateCard title="Цифровых версий пока нет" text="Создайте первую коллекцию раскрасок для товара.">
        <Button asChild>
          <Link href={routes.digitalVersionCreate}>
            <Plus data-icon="inline-start" aria-hidden="true" />
            Создать цифровую версию
          </Link>
        </Button>
      </StateCard>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {collections.map((collection) => (
        <CollectionCard key={collection.id} collection={collection} />
      ))}
    </div>
  );
}

function CollectionCard({ collection }: { readonly collection: ColoringCollection }) {
  const progress = Math.min(
    100,
    Math.round((collection.coloringCount / collection.expectedColoringCount) * 100),
  );

  return (
    <Card className="overflow-hidden pt-0">
      <div className="aspect-[16/9] overflow-hidden bg-muted">
        {collection.cover ? (
          // The storage host is dynamic, so Next Image cannot safely optimize this URL.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt={collection.cover.alt}
            className="size-full object-cover"
            height={collection.cover.height}
            loading="lazy"
            src={collection.cover.url}
            width={collection.cover.width}
          />
        ) : (
          <div className="flex size-full items-center justify-center text-muted-foreground">
            <ImageIcon className="size-9" aria-hidden="true" />
          </div>
        )}
      </div>
      <CardHeader className="gap-2">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="line-clamp-2">{collection.title}</CardTitle>
          <StatusBadge status={collection.status} />
        </div>
        <CardDescription className="line-clamp-1">
          Товар: {collection.product.title}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-2">
          <div className="flex justify-between gap-3 text-sm">
            <span>{collection.coloringCount} из {collection.expectedColoringCount}</span>
            <span className="text-muted-foreground">{progress}%</span>
          </div>
          <Progress aria-label={`Готовность ${progress}%`} value={progress} />
          <p className="text-xs text-muted-foreground">
            Опубликовано раскрасок: {collection.publishedColoringCount}
          </p>
        </div>
        <Button asChild className="w-full" variant="outline">
          <Link href={routes.digitalVersion(collection.id)}>
            <Pencil data-icon="inline-start" aria-hidden="true" />
            Управлять
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export function StatusBadge({ status }: { readonly status: string }) {
  const labels: Record<string, string> = {
    archived: "В архиве",
    draft: "Черновик",
    published: "Опубликовано",
  };

  return (
    <Badge variant={status === "published" ? "default" : "secondary"}>
      {labels[status] ?? status}
    </Badge>
  );
}

type StateCardProps = {
  readonly children?: React.ReactNode;
  readonly text: string;
  readonly title: string;
};

export function StateCard({ children, text, title }: StateCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{text}</CardDescription>
      </CardHeader>
      {children && <CardContent>{children}</CardContent>}
    </Card>
  );
}
