import { History } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui";

import {
  formatWorkshopModerationDate,
  getWorkshopModerationDecisionLabel,
} from "../lib";
import type { WorkshopModerationDetail } from "../model";

export function WorkshopModerationHistory({
  history,
}: {
  readonly history: WorkshopModerationDetail["decisionHistory"];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle
          className="flex items-center gap-2"
          role="heading"
          aria-level={2}
        >
          <History className="size-4" aria-hidden="true" />
          История решений
        </CardTitle>
      </CardHeader>
      <CardContent>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">Решений пока нет.</p>
        ) : (
          <ol className="grid gap-4">
            {history.map((entry) => (
              <li className="grid gap-1 border-l-2 pl-4" key={entry.id}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-medium">
                    {getWorkshopModerationDecisionLabel(entry.decision)}
                  </p>
                  <time
                    className="text-xs text-muted-foreground"
                    dateTime={entry.createdAt}
                  >
                    {formatWorkshopModerationDate(entry.createdAt)}
                  </time>
                </div>
                <p className="text-sm text-muted-foreground">
                  {entry.decision === "SUBMITTED" ? "Автор" : "Модератор"}: {entry.actor.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  Ревизия {entry.revisionId}
                </p>
                {entry.reason ? (
                  <p className="mt-1 whitespace-pre-wrap text-sm">
                    {entry.reason}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
