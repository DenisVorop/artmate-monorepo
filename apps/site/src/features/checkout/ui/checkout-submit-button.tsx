import { LoaderCircle, Send } from "lucide-react";
import type { ReactNode } from "react";

import { CtaGradientButton } from "@/shared/ui";

export function CheckoutSubmitButton({
  children,
  className,
  disabled,
  form,
  isSubmitting,
}: {
  children: ReactNode;
  className?: string;
  disabled: boolean;
  form: string;
  isSubmitting: boolean;
}) {
  return (
    <CtaGradientButton
      type="submit"
      form={form}
      disabled={disabled}
      size="lg"
      className={className}
    >
      {isSubmitting ? (
        <LoaderCircle data-icon="inline-start" className="animate-spin" />
      ) : (
        <Send data-icon="inline-start" />
      )}
      {children}
    </CtaGradientButton>
  );
}
