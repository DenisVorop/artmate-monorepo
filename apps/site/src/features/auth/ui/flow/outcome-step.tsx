import Image from "next/image";
import { LoaderCircle } from "lucide-react";

import { Button } from "@/shared/ui";

import type { AuthFlowViewProps } from "../../lib/flow-view.types";
import { stepFormClassName } from "./flow-layout";
import { StepHeading } from "./step-heading";

export function OutcomeStep({
  titleId,
  ...props
}: Extract<AuthFlowViewProps, { step: "provider" | "success" | "cancelled" }> & {
  titleId: string;
}) {
  return (
    <div className={`${stepFormClassName} justify-center`} aria-busy={props.step === "provider"}>
      {props.step === "success" ? (
        <>
          <Image src="/images/auth/success-check-3d.png" alt="" width={64} height={64} />
          <StepHeading id={titleId}>
            Вы вошли <span className="sm:block">в Artmate</span>
          </StepHeading>
        </>
      ) : props.step === "provider" ? (
        <>
          <LoaderCircle
            aria-hidden
            className="size-6 animate-spin text-rose-500 motion-reduce:animate-none"
          />
          <StepHeading id={titleId}>
            Возвращаемся <span className="sm:block">в Artmate</span>
          </StepHeading>
          <p role="status" className="text-sm leading-6 text-stone-500">
            Проверяем данные аккаунта.
          </p>
        </>
      ) : (
        <>
          <StepHeading id={titleId}>Вход отменён</StepHeading>
          <p className="text-sm leading-6 text-stone-500">Вы ещё не вошли в аккаунт.</p>
          <Button
            type="button"
            variant="outline"
            className="min-h-11 whitespace-normal"
            onClick={props.onRestart}
          >
            Вернуться ко входу
          </Button>
        </>
      )}
    </div>
  );
}
