"use client";
import Link from "next/link";
import { contestAppearances } from "@repo/ui/contest-design";
import { useContests } from "@/entities/contest";
import { routes } from "@/shared/constants";
import {
  Badge,
  Button,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui";
import { formatContestTime, stageLabels } from "../lib/form-values";
export function ContestsList() {
  const { contests, isError, isPending, refetch } = useContests();
  if (isPending) return <p role="status">Загружаем конкурсы…</p>;
  if (isError)
    return (
      <Card>
        <CardContent className="space-y-3 py-6">
          <p>Не удалось загрузить конкурсы</p>
          <Button variant="outline" onClick={() => void refetch()}>
            Попробовать снова
          </Button>
        </CardContent>
      </Card>
    );
  if (!contests.length)
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          Конкурсов пока нет
        </CardContent>
      </Card>
    );
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Конкурс</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead>Приём работ</TableHead>
              <TableHead>Выбор победителей</TableHead>
              <TableHead>Оформление</TableHead>
              <TableHead>Заявки</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contests.map((contest) => (
              <TableRow key={contest.id}>
                <TableCell>
                  <Link
                    className="font-medium underline-offset-4 hover:underline"
                    href={routes.contest(contest.id)}
                  >
                    {contest.title}
                  </Link>
                  <p className="mt-1 text-xs text-muted-foreground">
                    /{contest.slug}
                  </p>
                </TableCell>
                <TableCell>
                  <Badge variant={contest.published ? "default" : "secondary"}>
                    {stageLabels[contest.stage]}
                  </Badge>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {formatContestTime(contest.opensAt)}
                  <br />— {formatContestTime(contest.closesAt)}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {formatContestTime(contest.drawAt)}
                  <br />
                  <Link
                    href={routes.contestResults(contest.id)}
                    className="text-sm underline underline-offset-4"
                  >
                    Победители
                  </Link>
                </TableCell>
                <TableCell>
                  {contestAppearances[contest.appearance].label}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <Link
                    href={routes.contestEntries(contest.id)}
                    className="font-medium underline underline-offset-4"
                  >
                    {contest.entriesCount ?? 0} всего
                    {contest.pendingCount
                      ? ` · ${contest.pendingCount} на проверке`
                      : ""}
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
