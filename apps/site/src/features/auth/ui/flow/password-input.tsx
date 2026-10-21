"use client";

import type { ComponentProps } from "react";
import { Eye, EyeOff } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { Button, Input } from "@/shared/ui";

import { usePasswordVisibility } from "../../lib/use-password-visibility";
import { fieldInputClassName } from "./flow-layout";

type PasswordInputProps = Omit<ComponentProps<typeof Input>, "type"> & {
  visibilityLabel?: string;
};

export function PasswordInput({
  visibilityLabel = "пароль",
  className,
  disabled,
  ...props
}: PasswordInputProps) {
  const { isVisible, toggle } = usePasswordVisibility();
  const Icon = isVisible ? EyeOff : Eye;

  return (
    <div className="relative">
      <Input
        {...props}
        type={isVisible ? "text" : "password"}
        disabled={disabled}
        className={cn(fieldInputClassName, "pr-13", className)}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute top-0.5 right-0.5 size-11 rounded-lg text-stone-500"
        aria-label={`${isVisible ? "Скрыть" : "Показать"} ${visibilityLabel}`}
        aria-pressed={isVisible}
        aria-controls={props.id}
        disabled={disabled}
        onClick={toggle}
      >
        <Icon aria-hidden className="size-4.5" />
      </Button>
    </div>
  );
}
