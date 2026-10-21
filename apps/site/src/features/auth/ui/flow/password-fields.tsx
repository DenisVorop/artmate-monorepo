import type { UseFormRegisterReturn } from "react-hook-form";

import { Label } from "@/shared/ui";

import { FormError } from "./form-error";
import { PasswordInput } from "./password-input";

type PasswordFieldsProps = {
  idPrefix: string;
  passwordField: UseFormRegisterReturn<"password">;
  confirmationField: UseFormRegisterReturn<"passwordConfirm">;
  passwordError?: string;
  confirmationError?: string;
  disabled?: boolean;
};

export function PasswordFields(props: PasswordFieldsProps) {
  const passwordId = `${props.idPrefix}-password`;
  const confirmationId = `${props.idPrefix}-password-confirm`;

  return (
    <>
      <div data-auth-field className="space-y-1">
        <Label htmlFor={passwordId}>Придумайте пароль</Label>
        <PasswordInput
          {...props.passwordField}
          id={passwordId}
          autoComplete="new-password"
          placeholder="Не менее 8 символов"
          disabled={props.disabled}
          aria-invalid={!!props.passwordError}
          aria-describedby={props.passwordError ? `${passwordId}-error` : undefined}
        />
        <FormError reserveSpace id={`${passwordId}-error`} message={props.passwordError} />
      </div>
      <div data-auth-field className="space-y-1">
        <Label htmlFor={confirmationId}>Подтвердите пароль</Label>
        <PasswordInput
          {...props.confirmationField}
          id={confirmationId}
          autoComplete="new-password"
          placeholder="Введите пароль ещё раз"
          visibilityLabel="подтверждение пароля"
          disabled={props.disabled}
          aria-invalid={!!props.confirmationError}
          aria-describedby={props.confirmationError ? `${confirmationId}-error` : undefined}
        />
        <FormError reserveSpace id={`${confirmationId}-error`} message={props.confirmationError} />
      </div>
    </>
  );
}
