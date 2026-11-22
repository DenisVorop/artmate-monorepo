"use client";
import Link from "next/link";
import { useState } from "react";
import { useContest } from "@/entities/contest";
import {
  useContestEntries,
  contestEntryStatusLabels,
  formatEntryDate,
  type ContestEntryStatus,
} from "@/entities/contest-entry";
import { routes } from "@/shared/constants";
import {
  Badge,
  Button,
  Card,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui";
export function ContestEntriesList({ contestId }: { contestId: string }) {
  const [status, setStatus] = useState<ContestEntryStatus | "all">("PENDING");
  const { contest } = useContest(contestId);
  const {
    entries,
    isPending,
    isError,
    refetch,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
  } = useContestEntries(contestId, status);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">{contest?.title}</h2>
          <Link
            href={routes.contest(contestId)}
            className="text-sm underline underline-offset-4"
          >
            Настройки конкурса
          </Link>
        </div>
        <Select
          value={status}
          onValueChange={(value) =>
            setStatus(value as ContestEntryStatus | "all")
          }
        >
          <SelectTrigger className="w-52" aria-label="Статус заявки">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все заявки</SelectItem>
            {Object.entries(contestEntryStatusLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {isPending ? (
        <p role="status">Загружаем заявки…</p>
      ) : isError ? (
        <div className="space-y-3">
          <p>Не удалось загрузить заявки</p>
          <Button variant="outline" onClick={() => void refetch()}>
            Повторить
          </Button>
        </div>
      ) : !entries.length ? (
        <p className="py-10 text-center text-muted-foreground">
          Заявок с таким статусом нет
        </p>
      ) : (
        <Card className="overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Участник</TableHead>
                <TableHead>Альбом</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead>Отправлена</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>
                    <p className="font-medium">{entry.author.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {entry.author.email}
                    </p>
                  </TableCell>
                  <TableCell>
                    {entry.albumTitle}
                    {entry.number ? ` · № ${entry.number}` : ""}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {contestEntryStatusLabels[entry.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatEntryDate(entry.createdAt)}
                  </TableCell>
                  <TableCell>
                    <Button asChild variant="outline">
                      <Link href={routes.contestEntry(entry.id)}>Открыть</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
      {hasNextPage && (
        <div className="space-y-2 text-center">
          {isFetchNextPageError && (
            <p role="alert">Не удалось загрузить следующие заявки</p>
          )}
          <Button
            variant="outline"
            disabled={isFetchingNextPage}
            onClick={() => void fetchNextPage()}
          >
            {isFetchingNextPage ? "Загружаем…" : "Показать ещё"}
          </Button>
        </div>
      )}
    </div>
  );
}
