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
        "flex items-start gap-3 rounded-lg border bg-muted/30 p-3 text-sm",
        hasError && "border-destructive/50 bg-destructive/5",
        className,
      )}
    >
      <input
        id={id}
        ref={ref}
        type="checkbox"
        className="mt-0.5 size-4 shrink-0 rounded border-border accent-rose-500"
        aria-invalid={hasError}
        {...props}
      />
      <span className="text-muted-foreground">
        <label htmlFor={id} className="cursor-pointer">
          Я согласен на обработку персональных данных в соответствии с{" "}
        </label>
        <Link href={routes.legal.privacyPolicy} className="text-foreground underline">
          Политикой конфиденциальности
        </Link>
        <label htmlFor={id} className="cursor-pointer">
          {" "}
          и{" "}
        </label>
        <Link href={routes.legal.personalDataConsent} className="text-foreground underline">
          Согласием на обработку персональных данных
        </Link>
        <label htmlFor={id} className="cursor-pointer">
          .
        </label>
      </span>
    </div>
  );
});
