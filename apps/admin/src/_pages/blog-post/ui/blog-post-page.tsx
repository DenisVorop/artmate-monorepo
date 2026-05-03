import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import type { AuthUser } from "@/entities/session";
import { SessionMenu } from "@/features/auth";
import { BlogPostDetailsManagement } from "@/features/blog-management";
import { routes } from "@/shared/constants";
import { Badge, Button } from "@/shared/ui";
import { AdminShell } from "@/widgets/admin-shell";

type BlogPostPageProps = {
  readonly currentUser: AuthUser;
  readonly postId: string;
};

export function BlogPostPage({ currentUser, postId }: BlogPostPageProps) {
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
              <Badge variant="outline">Карточка поста</Badge>
            </div>
            <h1 className="truncate text-3xl font-semibold tracking-normal sm:text-4xl">
              Карточка поста
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">{postId}</p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <SessionMenu user={currentUser} />
          </div>
        </header>

        <BlogPostDetailsManagement postId={postId} />
      </section>
    </AdminShell>
  );
}
