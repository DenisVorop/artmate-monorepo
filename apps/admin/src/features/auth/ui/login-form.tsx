"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { LoaderCircle, LogIn } from "lucide-react";

import { routes } from "@/shared/constants";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
} from "@/shared/ui";

import {
  adminLoginFormDefaultValues,
  adminLoginFormSchema,
  getAuthErrorMessage,
  getSafeRedirectPath,
  toAdminLoginInput,
  type AdminLoginFormValues,
} from "../lib";
import { useLoginAdmin } from "../model";

type LoginFormProps = {
  readonly nextPath?: string;
};

export function LoginForm({ nextPath = routes.users }: LoginFormProps) {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string>();
  const { isPending, mutate: login } = useLoginAdmin();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AdminLoginFormValues>({
    defaultValues: adminLoginFormDefaultValues,
    resolver: zodResolver(adminLoginFormSchema),
  });
  const redirectPath = getSafeRedirectPath(nextPath);
  const submitForm = handleSubmit(async (values) => {
    setSubmitError(undefined);

    try {
      await login(toAdminLoginInput(values));
      router.replace(redirectPath);
      router.refresh();
    } catch (error) {
      setSubmitError(getAuthErrorMessage(error));
    }
  });

  return (
    <Card className="mx-auto w-full max-w-sm rounded-lg">
      <CardHeader>
        <CardTitle>Вход в админ-панель</CardTitle>
        <CardDescription>
          Используйте учетную запись с ролью администратора
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4" onSubmit={submitForm}>
          <label className="grid gap-1.5">
            <span className="text-sm font-medium">Логин</span>
            <Input
              autoComplete="username"
              autoFocus
              aria-invalid={Boolean(errors.login)}
              required
              {...register("login")}
            />
            <FieldError message={errors.login?.message} />
          </label>

          <label className="grid gap-1.5">
            <span className="text-sm font-medium">Пароль</span>
            <Input
              autoComplete="current-password"
              minLength={1}
              aria-invalid={Boolean(errors.password)}
              required
              type="password"
              {...register("password")}
            />
            <FieldError message={errors.password?.message} />
          </label>

          {submitError ? (
            <p
              className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
              role="alert"
            >
              {submitError}
            </p>
          ) : null}

          <Button disabled={isPending} type="submit">
            {isPending ? (
              <LoaderCircle
                data-icon="inline-start"
                className="animate-spin"
                aria-hidden="true"
              />
            ) : (
              <LogIn data-icon="inline-start" aria-hidden="true" />
            )}
            Войти
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function FieldError({ message }: { readonly message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="text-sm text-destructive">{message}</p>;
}
