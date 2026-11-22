import Link from "next/link";
import type { AuthUser } from "@/entities/session";
import { SessionMenu } from "@/features/auth";
import { ContestEditor, ContestsList } from "@/features/contests-management";
import { ContestResults } from "@/features/contest-results";
import { routes } from "@/shared/constants";
import { Button } from "@/shared/ui";
import { AdminShell } from "@/widgets/admin-shell";
export function ContestsPage({
  currentUser,
  mode = "list",
  contestId,
}: {
  currentUser: AuthUser;
  mode?: "list" | "create" | "edit" | "results";
  contestId?: string;
}) {
  return (
    <AdminShell activePath={routes.contests}>
      <section className="min-w-0 p-4 sm:p-6 lg:p-8">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            {mode !== "list" && (
              <Link
                className="mb-3 inline-block text-sm text-muted-foreground underline-offset-4 hover:underline"
                href={routes.contests}
              >
                ← Конкурсы
              </Link>
            )}
            <h1 className="text-3xl font-semibold">
              {mode === "list"
                ? "Конкурсы"
                : mode === "create"
                  ? "Новый конкурс"
                  : mode === "results"
                    ? "Победители"
                    : "Редактирование конкурса"}
            </h1>
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            {mode === "list" && (
              <Button asChild>
                <Link href={routes.contestCreate}>Создать конкурс</Link>
              </Button>
            )}
            {mode === "edit" && contestId && (
              <Button asChild variant="outline">
                <Link href={routes.contestResults(contestId)}>Победители</Link>
              </Button>
            )}
            {mode === "results" && contestId && (
              <Button asChild variant="outline">
                <Link href={routes.contest(contestId)}>Настройки конкурса</Link>
              </Button>
            )}
            {mode === "edit" && contestId && (
              <Button asChild variant="outline">
                <Link href={routes.contestEntries(contestId)}>
                  Заявки на конкурс
                </Link>
              </Button>
            )}
            <SessionMenu user={currentUser} />
          </div>
        </header>
        {mode === "list" ? (
          <ContestsList />
        ) : mode === "results" && contestId ? (
          <ContestResults contestId={contestId} />
        ) : (
          <ContestEditor contestId={contestId} />
        )}
      </section>
    </AdminShell>
  );
}
