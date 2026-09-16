import { CircleOff, ExternalLink, Sparkles } from "lucide-react";

import { LogoutButton } from "@/features/auth/client";
import { publicSiteUrl } from "@/shared/constants";
import { Button, Card, CardContent } from "@/shared/ui";

export function AccessDeniedPage() {
  return (
    <main className="login-canvas grid min-h-screen place-items-center p-4">
      <Card className="w-full max-w-xl py-8 shadow-shell sm:py-10">
        <CardContent className="px-6 text-center sm:px-10">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-rose-100 text-rose-700">
            <CircleOff aria-hidden="true" />
          </span>
          <p className="mt-6 inline-flex items-center gap-2 font-heading text-lg font-bold text-ink">
            <Sparkles className="size-4 text-rose-600" aria-hidden="true" />
            artmate partner
          </p>
          <h1 className="font-heading mt-4 text-3xl font-bold text-balance text-ink">
            Нет доступа к кабинету
          </h1>
          <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-muted-foreground">
            Свяжитесь с менеджером Artmate, чтобы уточнить статус
            сотрудничества.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild variant="outline">
              <a href={publicSiteUrl}>
                На сайт Artmate
                <ExternalLink aria-hidden="true" />
              </a>
            </Button>
            <LogoutButton />
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
