import { Fragment, type ReactNode } from "react";

import { cn } from "@/shared/lib/utils";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "./breadcrumb";
import { Link } from "./link";
import { PageTitle } from "./typography";

type PageHeroProps = {
  title: ReactNode;
  description?: ReactNode;
  breadcrumbs: readonly { label: string; href?: string }[];
  actions?: ReactNode;
};

export function PageHero({ title, description, breadcrumbs, actions }: PageHeroProps) {
  return (
    <header data-slot="page-hero" className="space-y-7 md:space-y-9">
      <Breadcrumb>
        <BreadcrumbList>
          {breadcrumbs.map((item, index) => (
            <Fragment key={`${item.href ?? "current"}-${item.label}`}>
              {index > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem>
                {item.href && index < breadcrumbs.length - 1 ? (
                  <BreadcrumbLink asChild>
                    <Link href={item.href}>{item.label}</Link>
                  </BreadcrumbLink>
                ) : (
                  <BreadcrumbPage>{item.label}</BreadcrumbPage>
                )}
              </BreadcrumbItem>
            </Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
      <div className={cn("grid gap-x-8 gap-y-3", actions && "sm:grid-cols-[minmax(0,1fr)_auto]")}>
        <PageTitle className="sm:col-start-1 sm:row-start-1">{title}</PageTitle>
        {description && (
          <div className="max-w-2xl text-sm leading-6 text-stone-600 sm:col-start-1 sm:row-start-2">
            {description}
          </div>
        )}
        {actions && (
          <div className="flex min-w-0 flex-col gap-3 sm:col-start-2 sm:row-start-1 sm:flex-row sm:self-end">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}
