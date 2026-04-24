import { AlertCircle, Inbox } from "lucide-react";

import { cn } from "@/shared/lib/utils";

import { Card, CardContent, CardDescription, CardTitle } from "./card";

type DataStateProps = {
  title: string;
  description: string;
  variant?: "empty" | "error";
  className?: string;
};

export function DataState({
  title,
  description,
  variant = "empty",
  className,
}: DataStateProps) {
  const Icon = variant === "error" ? AlertCircle : Inbox;

  return (
    <Card className={cn("mx-auto max-w-xl", className)}>
      <CardContent className="flex flex-col items-center py-10 text-center">
        <span className="mb-4 flex size-12 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Icon className="size-6" />
        </span>
        <CardTitle className="text-xl">{title}</CardTitle>
        <CardDescription className="mt-2 max-w-md">{description}</CardDescription>
      </CardContent>
    </Card>
  );
}
