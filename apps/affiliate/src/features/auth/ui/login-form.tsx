"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { useForm } from "react-hook-form";

import { Button, Input } from "@/shared/ui";

import {
  getAuthErrorMessage,
  loginFormDefaultValues,
  loginFormSchema,
  toLoginInput,
  type LoginFormValues,
} from "../lib/login-form";
import { getSafeRedirectPath } from "../lib/safe-redirect";
import { useLogin } from "../model/use-login";

export function LoginForm({ nextPath }: { readonly nextPath?: string }) {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string>();
  const { isPending, mutate: login } = useLogin();
  const {
    formState: { errors },
    handleSubmit,
    register,
  } = useForm<LoginFormValues>({
    defaultValues: loginFormDefaultValues,
    resolver: zodResolver(loginFormSchema),
  });
  const submitForm = handleSubmit(async (values) => {
    setSubmitError(undefined);

    try {
      const result = await login(toLoginInput(values));

      if (!result.ok) {
        setSubmitError(getAuthErrorMessage(result.error.status));
        return;
      }

      router.replace(getSafeRedirectPath(nextPath));
      router.refresh();
    } catch {
      setSubmitError(getAuthErrorMessage(503));
    }
  });

  return (
    <form className="grid gap-5" onSubmit={submitForm}>
      <label className="grid gap-2">
        <span className="text-sm font-bold">Email</span>
        <Input
          autoComplete="email"
          autoFocus
          aria-invalid={Boolean(errors.email)}
          placeholder="name@example.ru"
          type="email"
          {...register("email")}
        />
        <FieldError message={errors.email?.message} />
      </label>

      <label className="grid gap-2">
        <span className="text-sm font-bold">Пароль</span>
        <Input
          autoComplete="current-password"
          aria-invalid={Boolean(errors.password)}
          type="password"
          {...register("password")}
        />
        <FieldError message={errors.password?.message} />
      </label>

      {submitError ? (
        <p
          className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive"
          role="alert"
        >
          {submitError}
        </p>
      ) : null}

      <Button
        className="mt-1 w-full"
        disabled={isPending}
        size="lg"
        type="submit"
      >
        {isPending ? (
          <LoaderCircle className="animate-spin" aria-hidden="true" />
        ) : (
          <ArrowRight aria-hidden="true" />
        )}
        Войти в кабинет
      </Button>
    </form>
  );
}

function FieldError({ message }: { readonly message?: string }) {
  return message ? (
    <span className="text-sm text-destructive">{message}</span>
  ) : null;
}
