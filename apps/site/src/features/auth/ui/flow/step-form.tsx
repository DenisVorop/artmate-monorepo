import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/shared/lib/utils";

import { BenefitsPanel } from "./benefits-panel";
import { fieldStackClassName, flowGridClassName } from "./flow-layout";
import { FormError } from "./form-error";

type StepFormProps = Pick<ComponentProps<"form">, "onSubmit"> & {
  children: ReactNode;
  actions: ReactNode;
  isPending?: boolean;
  error?: string;
  reserveErrorSpace?: boolean;
};

export function StepForm({
  children,
  actions,
  onSubmit,
  isPending,
  error,
  reserveErrorSpace = true,
}: StepFormProps) {
  return (
    <form
      className={cn(flowGridClassName, reserveErrorSpace && "gap-y-4 sm:gap-y-0")}
      onSubmit={onSubmit}
      aria-busy={isPending}
      noValidate
    >
      <div className={cn("min-w-0 pt-2", fieldStackClassName)}>{children}</div>
      <BenefitsPanel className="sm:col-start-2 sm:row-span-2 sm:row-start-1" />
      <div className="min-w-0 sm:col-start-1 sm:row-start-2 sm:self-end">
        {reserveErrorSpace && <FormError message={error} reserveSpace className="min-h-10 pb-2" />}
        <div className="space-y-3">{actions}</div>
      </div>
    </form>
  );
}
