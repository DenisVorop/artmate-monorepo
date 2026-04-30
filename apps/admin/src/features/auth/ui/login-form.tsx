"use client";

import { useActionState } from "react";
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

import { loginAdminAction } from "../model/login-action";
import { initialLoginFormState } from "../model/login-state";

type LoginFormProps = {
  readonly nextPath?: string;
};

export function LoginForm({ nextPath = routes.users }: LoginFormProps) {
  const [state, formAction, isPending] = useActionState(
    loginAdminAction,
    initialLoginFormState,
  );

  return (
    <Card className="mx-auto w-full max-w-sm rounded-lg">
      <CardHeader>
        <CardTitle>Вход в админ-панель</CardTitle>
        <CardDescription>
          Используйте учетную запись с ролью администратора
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid gap-4">
          <input name="next" type="hidden" value={nextPath} />

          <label className="grid gap-1.5">
            <span className="text-sm font-medium">Логин</span>
            <Input
              autoComplete="username"
              autoFocus
              defaultValue={state.values.login}
              name="login"
              required
            />
          </label>

          <label className="grid gap-1.5">
            <span className="text-sm font-medium">Пароль</span>
            <Input
              autoComplete="current-password"
              minLength={1}
              name="password"
              required
              type="password"
            />
          </label>

          {state.error ? (
            <p
              className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
              role="alert"
            >
              {state.error}
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
