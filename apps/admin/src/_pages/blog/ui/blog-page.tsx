import type { AuthUser } from "@/entities/session";
import { SessionMenu } from "@/features/auth";
import { BlogManagement } from "@/features/blog-management";
import { routes } from "@/shared/constants";
import { Badge } from "@/shared/ui";
import { AdminShell } from "@/widgets/admin-shell";

type BlogPageProps = {
  readonly currentUser: AuthUser;
};

export function BlogPage({ currentUser }: BlogPageProps) {
  return (
    <AdminShell activePath={routes.blog}>
      <section className="min-w-0 p-4 sm:p-6 lg:p-8">
        <header className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <Badge variant="outline">Контент</Badge>
            <h1 className="mt-3 text-3xl font-semibold tracking-normal sm:text-4xl">
              Блог
            </h1>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <SessionMenu user={currentUser} />
          </div>
        </header>

        <BlogManagement />
      </section>
    </AdminShell>
  );
}
