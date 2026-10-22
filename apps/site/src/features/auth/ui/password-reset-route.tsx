"use client";

import { useId } from "react";

import { routes } from "@/shared/constants";
import { Button, CtaGradientButton } from "@/shared/ui";
import { usePasswordResetRoute } from "../lib/use-password-reset-route";
import { FlowLayout, primaryButtonClassName } from "./flow/flow-layout";
import { PasswordFields } from "./flow/password-fields";
import { StepForm } from "./flow/step-form";
import { StepHeading } from "./flow/step-heading";
import { AuthPageShell } from "./auth-page-shell";

export function PasswordResetRoute({ token }: { token?: string }) {
  const titleId = useId();
  const { register, errors, submit, isPending, isReset, hasToken, error } =
    usePasswordResetRoute(token);
  return (
    <main>
      <AuthPageShell>
        <section
          aria-labelledby={titleId}
          className="w-full max-w-177 rounded-[22px] border border-stone-200 bg-white shadow-xl shadow-stone-900/5"
        >
          {isReset || !hasToken ? (
            <FlowLayout
              actions={
                <Button
                  asChild
                  className={`${primaryButtonClassName} border-0 bg-gradient-to-r from-rose-500 via-rose-400 to-orange-400 shadow-sm shadow-rose-500/20 hover:from-rose-500/95 hover:via-rose-400/95 hover:to-orange-400/95 focus-visible:ring-rose-400/30`}
                >
                  {isReset ? (
                    <a href={routes.auth}>Войти</a>
                  ) : (
                    <a href={routes.authRecovery}>Запросить новую ссылку</a>
                  )}
                </Button>
              }
            >
              <StepHeading id={titleId}>{isReset ? "Пароль обновлён" : "Смена пароля"}</StepHeading>
              <p className="text-sm leading-6 text-stone-500">
                {isReset
                  ? "Теперь можно войти с новым паролем."
                  : "Ссылка недействительна или истекла."}
              </p>
            </FlowLayout>
          ) : (
            <StepForm
              onSubmit={submit}
              isPending={isPending}
              error={error}
              actions={
                <>
                  {error && (
                    <Button
                      asChild
                      variant="outline"
                      className="min-h-11 w-full text-stone-500 hover:text-stone-700"
                    >
                      <a href={routes.authRecovery}>Запросить новую ссылку</a>
                    </Button>
                  )}
                  <CtaGradientButton
                    type="submit"
                    className={primaryButtonClassName}
                    disabled={isPending}
                  >
                    Сменить пароль
                  </CtaGradientButton>
                </>
              }
            >
              <StepHeading id={titleId}>Смена пароля</StepHeading>
              <PasswordFields
                idPrefix={titleId}
                passwordField={register("password")}
                confirmationField={register("passwordConfirm")}
                passwordError={errors.password?.message}
                confirmationError={errors.passwordConfirm?.message}
                disabled={isPending}
              />
            </StepForm>
          )}
        </section>
      </AuthPageShell>
    </main>
  );
}
