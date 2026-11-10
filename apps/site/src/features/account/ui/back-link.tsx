"use client";

import { ArrowLeft } from "lucide-react";
import { routes } from "@/shared/constants";
import { Button } from "@/shared/ui";
import { Link } from "@/shared/ui/link";
import { useAnalytics } from "../lib/analytics";

export function AccountBackLink() {
  const analytics = useAnalytics();
  return (
    <Button asChild variant="ghost" className="-ml-3 min-h-11">
      <Link href={routes.account} onClick={analytics.backOpened}>
        <ArrowLeft className="size-4" />
        Личный кабинет
      </Link>
    </Button>
  );
}
