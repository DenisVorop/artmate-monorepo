import { ArrowRight, MessageCircle } from "lucide-react";

import { Button, Card, CardContent, CardDescription, CardTitle, routes } from "@/shared";
import { Link } from "@/shared/ui/link";

export function HelpCard() {
  return (
    <Card className="bg-muted/50">
      <CardContent className="flex flex-col gap-5 py-6 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
        <div className="flex flex-col items-center gap-3 sm:flex-row">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-600 ring-1 ring-rose-200/70">
            <MessageCircle className="size-5" />
          </span>
          <div className="space-y-1">
            <CardTitle className="text-xl">Не&nbsp;нашли ответ?</CardTitle>
            <CardDescription>
              Команда поддержки ответит в&nbsp;течение одного рабочего дня.
            </CardDescription>
          </div>
        </div>

        <Button asChild size="lg" className="h-11">
          <Link href={routes.contacts}>
            Написать нам
            <ArrowRight data-icon="inline-end" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
