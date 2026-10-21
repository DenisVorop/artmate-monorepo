import Image from "next/image";
import { LoaderCircle } from "lucide-react";

import { Button } from "@/shared/ui";

import type { AuthFlowViewProps } from "../../lib/flow-view.types";
import { stepFormClassName } from "./flow-layout";
import { FormError } from "./form-error";
import { StepHeading } from "./step-heading";

export function OutcomeStep({
  titleId,
  ...props
}: Extract<
  AuthFlowViewProps,
  { step: "provider" | "activation-loading" | "completion" | "success" | "cancelled" }
> & {
  titleId: string;
}) {
  if (props.step === "success") {
    return (
      <div
        role="status"
        className="flex flex-col items-center gap-5 px-5 pt-10 pb-14 text-center sm:px-8 sm:pt-12 sm:pb-16"
      >
        <Image src="/images/auth/success-check-3d.png" alt="" width={64} height={64} />
        <StepHeading id={titleId}>Вы вошли в Artmate</StepHeading>
      </div>
    );
  }

  if (props.step === "completion") {
    return (
      <div className={`${stepFormClassName} justify-center`} aria-busy={props.isPending}>
        {props.isPending && (
          <LoaderCircle
            aria-hidden
            className="size-6 animate-spin text-rose-500 motion-reduce:animate-none"
          />
        )}
        <StepHeading id={titleId}>Завершаем вход</StepHeading>
        {!props.error && (
          <p role="status" className="text-sm leading-6 text-stone-500">
            Подождите немного.
          </p>
        )}
        <FormError message={props.error} />
        {props.onRetry && (
          <Button
            type="button"
            variant="outline"
            className="text-stone-500 hover:text-stone-700"
            disabled={props.isPending}
            onClick={props.onRetry}
          >
            Повторить
          </Button>
        )}
      </div>
    );
  }

  return (
    <div
      className={`${stepFormClassName} justify-center`}
      aria-busy={props.step === "provider" || props.step === "activation-loading"}
    >
      {props.step === "provider" || props.step === "activation-loading" ? (
        <>
          <LoaderCircle
            aria-hidden
            className="size-6 animate-spin text-rose-500 motion-reduce:animate-none"
          />
          <StepHeading id={titleId}>
            {props.step === "activation-loading" ? (
              "Проверяем ссылку"
            ) : (
              <>
                Возвращаемся <span className="sm:block">в Artmate</span>
              </>
            )}
          </StepHeading>
          <p role="status" className="text-sm leading-6 text-stone-500">
            {props.step === "activation-loading"
              ? "Подождите немного."
              : "Завершите вход в окне Яндекса."}
          </p>
          {props.step === "provider" && props.onLogin && (
            <Button
              type="button"
              variant="outline"
              className="text-stone-500 hover:text-stone-700"
              onClick={props.onLogin}
            >
              Другой способ входа
            </Button>
          )}
        </>
      ) : (
        <>
          <StepHeading id={titleId}>Вход отменён</StepHeading>
          <p className="text-sm leading-6 text-stone-500">Вы ещё не вошли в аккаунт.</p>
          <Button
            type="button"
            variant="outline"
            className="min-h-11 whitespace-normal text-stone-500 hover:text-stone-700"
            onClick={props.onRestart}
          >
            Вернуться ко входу
          </Button>
        </>
      )}
    </div>
  );
}
