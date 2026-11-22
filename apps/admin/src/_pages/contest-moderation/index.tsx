import type { AuthUser } from "@/entities/session";
import { SessionMenu } from "@/features/auth";
import {
  ContestEntriesList,
  ContestEntryDetail,
} from "@/features/contest-moderation";
import { routes } from "@/shared/constants";
import { AdminShell } from "@/widgets/admin-shell";
export function ContestModerationPage({
  currentUser,
  contestId,
  entryId,
}: {
  currentUser: AuthUser;
  contestId?: string;
  entryId?: string;
}) {
  return (
    <AdminShell activePath={routes.contests}>
      <section className="min-w-0 p-4 sm:p-6 lg:p-8">
        <header className="mb-6 flex items-center justify-between gap-4">
          <h1 className="text-3xl font-semibold">
            {entryId ? "Проверка работы" : "Заявки на конкурс"}
          </h1>
          <SessionMenu user={currentUser} />
        </header>
        {entryId ? (
          <ContestEntryDetail entryId={entryId} />
        ) : contestId ? (
          <ContestEntriesList contestId={contestId} />
        ) : null}
      </section>
    </AdminShell>
  );
}
