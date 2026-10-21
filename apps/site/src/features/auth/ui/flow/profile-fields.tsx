import type { UseFormRegisterReturn } from "react-hook-form";

import { Input, Label } from "@/shared/ui";

import { usePhoneMask } from "../../lib/use-phone-mask";

import { fieldInputClassName } from "./flow-layout";
import { FormError } from "./form-error";

export function ProfileFields(props: {
  idPrefix: string;
  nameField: UseFormRegisterReturn<"name">;
  phoneField: UseFormRegisterReturn<"phone">;
  nameError?: string;
  phoneError?: string;
  disabled?: boolean;
  missingFields?: ("name" | "phone")[];
}) {
  const phoneMask = usePhoneMask(props.phoneField.onChange);
  const nameId = `${props.idPrefix}-name`;
  const phoneId = `${props.idPrefix}-phone`;

  return (
    <>
      <div data-auth-field className="space-y-1">
        <Label htmlFor={nameId}>ФИО</Label>
        <Input
          {...props.nameField}
          id={nameId}
          autoComplete="name"
          readOnly={props.missingFields !== undefined && !props.missingFields.includes("name")}
          maxLength={120}
          placeholder="Анна Иванова"
          className={fieldInputClassName}
          disabled={props.disabled}
          aria-invalid={!!props.nameError}
          aria-describedby={props.nameError ? `${nameId}-error` : undefined}
        />
        <FormError reserveSpace id={`${nameId}-error`} message={props.nameError} />
      </div>
      <div data-auth-field className="space-y-1">
        <Label htmlFor={phoneId}>Номер телефона</Label>
        <Input
          {...props.phoneField}
          id={phoneId}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          onFocus={phoneMask.onFocus}
          onChange={phoneMask.onChange}
          readOnly={props.missingFields !== undefined && !props.missingFields.includes("phone")}
          maxLength={18}
          placeholder="+7 (999) 123 45 67"
          className={fieldInputClassName}
          disabled={props.disabled}
          aria-invalid={!!props.phoneError}
          aria-describedby={props.phoneError ? `${phoneId}-error` : undefined}
        />
        <FormError reserveSpace id={`${phoneId}-error`} message={props.phoneError} />
      </div>
    </>
  );
}
