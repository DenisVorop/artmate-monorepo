import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import type { AuthUser } from "@/entities/session";
import { SessionMenu } from "@/features/auth";
import { BlogPostsManagement } from "@/features/blog-management";
import { routes } from "@/shared/constants";
import { Badge, Button } from "@/shared/ui";
import { AdminShell } from "@/widgets/admin-shell";

type BlogPostsPageProps = {
  readonly currentUser: AuthUser;
};

export function BlogPostsPage({ currentUser }: BlogPostsPageProps) {
  return (
    <AdminShell activePath={routes.blog}>
      <section className="min-w-0 p-4 sm:p-6 lg:p-8">
        <header className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Button asChild size="sm" variant="outline">
                <Link href={routes.blog}>
                  <ArrowLeft data-icon="inline-start" aria-hidden="true" />
                  Блог
                </Link>
              </Button>
              <Badge variant="outline">Контент</Badge>
            </div>
            <h1 className="truncate text-3xl font-semibold tracking-normal sm:text-4xl">
              Посты блога
            </h1>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <SessionMenu user={currentUser} />
          </div>
        </header>

        <BlogPostsManagement />
      </section>
    </AdminShell>
  );
}
