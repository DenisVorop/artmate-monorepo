import { ArrowRight, LoaderCircle } from "lucide-react";
import type { ReactNode, Ref } from "react";

import { CtaGradientButton } from "@/shared/ui";

export function CheckoutSubmitButton({
  children,
  className,
  disabled,
  form,
  isSubmitting,
  ref,
}: {
  children: ReactNode;
  className?: string;
  disabled: boolean;
  form: string;
  isSubmitting: boolean;
  ref?: Ref<HTMLButtonElement>;
}) {
  return (
    <CtaGradientButton
      ref={ref}
      type="submit"
      form={form}
      disabled={disabled}
      size="lg"
      className={className}
    >
      {isSubmitting && <LoaderCircle data-icon="inline-start" className="animate-spin" />}
      {children}
      {!isSubmitting && <ArrowRight data-icon="inline-end" />}
    </CtaGradientButton>
  );
}
