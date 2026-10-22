import { CtaGradientButton } from "@/shared/ui";

import type { AuthFlowViewProps } from "../../lib/flow-view.types";
import { FlowLayout, primaryButtonClassName } from "./flow-layout";
import { StepHeading } from "./step-heading";

export function RecoveryResult({
  titleId,
  ...props
}: Extract<AuthFlowViewProps, { step: "recovery-sent" | "activation-invalid" }> & {
  titleId: string;
}) {
  return (
    <FlowLayout
      actions={
        <CtaGradientButton
          type="button"
          className={primaryButtonClassName}
          disabled={props.isPending}
          onClick={props.step === "recovery-sent" ? props.onLogin : props.onRecovery}
        >
          {props.step === "recovery-sent" ? "Вернуться ко входу" : "Запросить новую ссылку"}
        </CtaGradientButton>
      }
    >
      <StepHeading id={titleId}>
        {props.step === "recovery-sent" ? "Проверьте почту" : "Ссылка не действует"}
      </StepHeading>
      <p role="status" className="text-sm leading-6 text-stone-500">
        {props.step === "recovery-sent"
          ? "Если аккаунт с этой почтой существует, на неё придёт письмо для восстановления доступа."
          : "Ссылка не действует. Запросите новое письмо."}
      </p>
    </FlowLayout>
  );
}
