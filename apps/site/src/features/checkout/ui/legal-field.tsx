"use client";

import { useFormContext } from "react-hook-form";

import { routes } from "@/shared/constants";
import { cn } from "@/shared/lib";
import { Link } from "@/shared/ui/link";

import { type CheckoutFormValues } from "../lib";

export function LegalField() {
  const {
    register,
    formState: { errors },
  } = useFormContext<CheckoutFormValues>();

  return (
    <label
      className={cn(
        "flex items-start gap-3 rounded-lg border bg-muted/30 p-3 text-sm",
        errors.acceptedLegal && "border-destructive/50 bg-destructive/5",
      )}
    >
      <input
        type="checkbox"
        className="mt-0.5 size-4 rounded border-border accent-rose-500"
        aria-invalid={Boolean(errors.acceptedLegal)}
        {...register("acceptedLegal")}
      />
      <span className="text-muted-foreground">
        Я принимаю{" "}
        <Link href={routes.legal.publicOffer} className="text-foreground underline">
          оферту
        </Link>{" "}
        и{" "}
        <Link href={routes.legal.personalDataConsent} className="text-foreground underline">
          соглашаюсь на обработку персональных данных
        </Link>
        .
      </span>
    </label>
  );
}
