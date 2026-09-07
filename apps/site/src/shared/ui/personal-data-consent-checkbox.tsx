import { forwardRef, type ComponentPropsWithoutRef } from "react";

import { routes } from "@/shared/constants";
import { cn } from "@/shared/lib";

import { Link } from "./link";

type PersonalDataConsentCheckboxProps = Omit<ComponentPropsWithoutRef<"input">, "id" | "type"> & {
  hasError?: boolean;
  id: string;
};

export const PersonalDataConsentCheckbox = forwardRef<
  HTMLInputElement,
  PersonalDataConsentCheckboxProps
>(function PersonalDataConsentCheckbox({ className, hasError, id, ...props }, ref) {
  return (
    <div
      className={cn(
        "flex items-start gap-1 rounded-lg border bg-muted/30 p-1 text-sm",
        hasError && "border-destructive/50 bg-destructive/5",
        className,
      )}
    >
      <label
        htmlFor={id}
        className="flex min-h-11 min-w-11 cursor-pointer items-center justify-center"
      >
        <input
          id={id}
          ref={ref}
          type="checkbox"
          className="size-4 shrink-0 rounded border-border accent-rose-500"
          aria-invalid={hasError}
          {...props}
        />
      </label>
      <span className="min-h-11 py-3 pr-2 text-muted-foreground">
        <label htmlFor={id} className="cursor-pointer">
          Я согласен на обработку персональных данных в соответствии с{" "}
        </label>
        <Link
          href={routes.legal.privacyPolicy}
          target="_blank"
          rel="noreferrer"
          aria-label="Политика конфиденциальности (откроется в новой вкладке)"
          className="text-foreground underline"
        >
          Политикой конфиденциальности
        </Link>
        <label htmlFor={id} className="cursor-pointer">
          {" "}
          и{" "}
        </label>
        <Link
          href={routes.legal.personalDataConsent}
          target="_blank"
          rel="noreferrer"
          aria-label="Согласие на обработку персональных данных (откроется в новой вкладке)"
          className="text-foreground underline"
        >
          Согласием на обработку персональных данных
        </Link>
        <label htmlFor={id} className="cursor-pointer">
          .
        </label>
      </span>
    </div>
  );
});
