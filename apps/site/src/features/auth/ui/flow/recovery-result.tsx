import { Button } from "@/shared/ui";

import type { AuthFlowViewProps } from "../../lib/flow-view.types";
import { stepFormClassName } from "./flow-layout";
import { StepHeading } from "./step-heading";

export function RecoveryResult({
  titleId,
  ...props
}: Extract<AuthFlowViewProps, { step: "recovery-sent" | "activation-invalid" }> & {
  titleId: string;
}) {
  return (
    <div className={`${stepFormClassName} justify-center`}>
      <StepHeading id={titleId}>
        {props.step === "recovery-sent" ? "Проверьте почту" : "Ссылка не действует"}
      </StepHeading>
      <p role="status" className="text-sm leading-6 text-stone-500">
        {props.step === "recovery-sent"
          ? "Если аккаунт с этой почтой существует, на неё придёт письмо для восстановления доступа."
          : "Ссылка не действует. Запросите новое письмо."}
      </p>
      <Button
        type="button"
        variant="outline"
        className="min-h-11 whitespace-normal text-stone-500 hover:text-stone-700"
        disabled={props.isPending}
        onClick={props.step === "recovery-sent" ? props.onLogin : props.onRecovery}
      >
        {props.step === "recovery-sent" ? "Вернуться ко входу" : "Запросить новую ссылку"}
      </Button>
    </div>
  );
}
