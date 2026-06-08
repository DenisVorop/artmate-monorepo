"use client";

import Link from "next/link";
import { ExternalLink, Pencil } from "lucide-react";

import {
  getCatalogLandingHref,
  getCatalogLandingProductSourceLabel,
  getCatalogLandingStatusLabel,
  useCatalogLandings,
} from "@/entities/catalog-landings";
import { routes } from "@/shared/constants";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui";

export function CatalogLandingsManagement() {
  const { isError, isPending, landings } = useCatalogLandings();

  if (isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Не удалось загрузить подборки</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Перезагрузите страницу и повторите действие.
        </CardContent>
      </Card>
    );
  }

  if (isPending) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Загрузка подборок</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Получаем список SEO-страниц каталога.
        </CardContent>
      </Card>
    );
  }

  if (landings.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Подборок пока нет</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm text-muted-foreground">
          <p>Создайте первую подборку, например пиксельные раскраски по номерам.</p>
          <div>
            <Button asChild>
              <Link href={routes.catalogLandingCreate}>Создать подборку</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Список подборок</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Название</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead>Источник</TableHead>
              <TableHead className="text-right">Товары</TableHead>
              <TableHead className="text-right">FAQ</TableHead>
              <TableHead className="w-36 text-right">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {landings.map((landing) => (
              <TableRow key={landing.id}>
                <TableCell className="font-medium">{landing.h1}</TableCell>
                <TableCell className="max-w-56 truncate text-muted-foreground">
                  {landing.slug}
                </TableCell>
                <TableCell>
                  <Badge variant={landing.status === "published" ? "default" : "secondary"}>
                    {getCatalogLandingStatusLabel(landing.status)}
                  </Badge>
                </TableCell>
                <TableCell>{getCatalogLandingProductSourceLabel(landing.productSource)}</TableCell>
                <TableCell className="text-right">{landing.products.length}</TableCell>
                <TableCell className="text-right">{landing.faqItems.length}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button asChild size="icon-sm" variant="outline">
                      <a
                        aria-label={`Открыть публичную страницу ${landing.h1}`}
                        href={getCatalogLandingHref(landing.slug)}
                        rel="noreferrer"
                        target="_blank"
                      >
                        <ExternalLink aria-hidden="true" />
                      </a>
                    </Button>
                    <Button asChild size="icon-sm">
                      <Link
                        aria-label={`Редактировать подборку ${landing.h1}`}
                        href={routes.catalogLanding(landing.id)}
                      >
                        <Pencil aria-hidden="true" />
                      </Link>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
