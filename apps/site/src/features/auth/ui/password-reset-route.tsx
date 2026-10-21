"use client";

import { useId } from "react";

import { routes } from "@/shared/constants";
import { Button, CtaGradientButton } from "@/shared/ui";
import { usePasswordResetRoute } from "../lib/use-password-reset-route";
import { fieldStackClassName, FlowLayout, primaryButtonClassName } from "./flow/flow-layout";
import { FormError } from "./flow/form-error";
import { PasswordFields } from "./flow/password-fields";
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
          <FlowLayout>
            <div className="space-y-5">
              <StepHeading id={titleId}>{isReset ? "Пароль обновлён" : "Смена пароля"}</StepHeading>
              {isReset ? (
                <>
                  <p className="text-sm leading-6 text-stone-500">
                    Теперь можно войти с новым паролем.
                  </p>
                  <Button asChild className="min-h-11 w-full">
                    <a href={routes.auth}>Войти</a>
                  </Button>
                </>
              ) : !hasToken ? (
                <>
                  <p className="text-sm leading-6 text-stone-500">
                    Ссылка недействительна или истекла.
                  </p>
                  <Button asChild className="min-h-11 w-full">
                    <a href={routes.authRecovery}>Запросить новую ссылку</a>
                  </Button>
                </>
              ) : (
                <form className={fieldStackClassName} onSubmit={submit}>
                  <PasswordFields
                    idPrefix={titleId}
                    passwordField={register("password")}
                    confirmationField={register("passwordConfirm")}
                    passwordError={errors.password?.message}
                    confirmationError={errors.passwordConfirm?.message}
                    disabled={isPending}
                  />
                  <FormError message={error} reserveSpace className="min-h-8" />
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
                </form>
              )}
            </div>
          </FlowLayout>
        </section>
      </AuthPageShell>
    </main>
  );
}
