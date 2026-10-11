"use client";

import { cn } from "@/shared/lib";

type FieldErrorProps = {
  id: string;
  message?: string;
  className?: string;
};

export function FieldError({ id, message, className }: FieldErrorProps) {
  if (!message) {
    return null;
  }

  return (
    <p id={id} role="alert" className={cn("text-xs leading-5 text-destructive", className)}>
      {message}
    </p>
  );
}
