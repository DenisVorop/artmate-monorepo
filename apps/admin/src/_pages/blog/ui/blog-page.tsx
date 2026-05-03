import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, FileText, FolderTree, Tags, UserRound } from "lucide-react";

import type { AuthUser } from "@/entities/session";
import { SessionMenu } from "@/features/auth";
import { routes } from "@/shared/constants";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui";
import { AdminShell } from "@/widgets/admin-shell";

type BlogPageProps = {
  readonly currentUser: AuthUser;
};

type BlogSection = {
  readonly description: string;
  readonly href: string;
  readonly Icon: LucideIcon;
  readonly title: string;
};

const blogSections: readonly BlogSection[] = [
  {
    description: "Список добавленных статей и панель создания нового поста.",
    href: routes.blogPosts,
    Icon: FileText,
    title: "Посты",
  },
  {
    description: "Авторы, которые доступны в карточке поста.",
    href: routes.blogAuthors,
    Icon: UserRound,
    title: "Авторы",
  },
  {
    description: "Категории для группировки статей блога.",
    href: routes.blogCategories,
    Icon: FolderTree,
    title: "Категории",
  },
  {
    description: "Теги для связей между статьями.",
    href: routes.blogTags,
    Icon: Tags,
    title: "Теги",
  },
];

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

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {blogSections.map((section) => (
            <Card key={section.href}>
              <CardHeader>
                <div className="mb-2 flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <section.Icon aria-hidden="true" className="size-4" />
                </div>
                <CardTitle>{section.title}</CardTitle>
                <CardDescription>{section.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline">
                  <Link href={section.href}>
                    Открыть
                    <ArrowRight data-icon="inline-end" aria-hidden="true" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </AdminShell>
  );
}
