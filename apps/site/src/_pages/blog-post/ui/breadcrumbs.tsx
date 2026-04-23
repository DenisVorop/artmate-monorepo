import type { BlogPost } from "@/entities/blog";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  routes,
} from "@/shared";
import { Link } from "@/shared/ui/link";

type BreadcrumbsProps = {
  post: BlogPost;
  currentLabel?: string;
  inverted?: boolean;
};

export function Breadcrumbs({
  post,
  currentLabel = post.title,
  inverted = false,
}: BreadcrumbsProps) {
  const linkClassName = inverted ? "text-white/75 hover:text-white" : undefined;
  const pageClassName = inverted
    ? "max-w-[14rem] truncate text-white/55 sm:max-w-sm"
    : "max-w-[14rem] truncate sm:max-w-sm";
  const separatorClassName = inverted ? "text-white/40" : undefined;

  return (
    <Breadcrumb>
      <BreadcrumbList className={inverted ? "text-white/75" : undefined}>
        <BreadcrumbItem>
          <BreadcrumbLink asChild className={linkClassName}>
            <Link href={routes.home}>Главная</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator className={separatorClassName} />
        <BreadcrumbItem>
          <BreadcrumbLink asChild className={linkClassName}>
            <Link href={routes.blog}>Блог</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator className={separatorClassName} />
        <BreadcrumbItem>
          <BreadcrumbPage className={pageClassName}>{currentLabel}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
