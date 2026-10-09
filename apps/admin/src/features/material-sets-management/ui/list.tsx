"use client";

import { materialKindLabels, useMaterialSets } from "@/entities/material-sets";
import {
  Badge,
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

export function MaterialSetsList() {
  const { materialSets, isPending, isError } = useMaterialSets();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Добавленные наборы</CardTitle>
      </CardHeader>
      <CardContent>
        {isError ? (
          <p role="alert" className="text-sm">
            Не удалось загрузить наборы. Обновите страницу.
          </p>
        ) : isPending ? (
          <p role="status" className="text-sm">
            Загружаем наборы…
          </p>
        ) : materialSets.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Наборов пока нет. Добавьте первый с помощью формы выше.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Название</TableHead>
                <TableHead>Бренд / серия</TableHead>
                <TableHead>Материалы</TableHead>
                <TableHead>Цветов</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {materialSets.map((set) => (
                <TableRow key={set.id}>
                  <TableCell>
                    <span className="font-medium">{set.title}</span>
                    {set.isArchived && (
                      <Badge className="ml-2" variant="secondary">
                        В архиве
                      </Badge>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {set.slug}
                    </p>
                  </TableCell>
                  <TableCell>
                    {set.brand}
                    {set.line ? ` / ${set.line}` : ""}
                  </TableCell>
                  <TableCell>{materialKindLabels[set.kind]}</TableCell>
                  <TableCell>{set.colorCount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
