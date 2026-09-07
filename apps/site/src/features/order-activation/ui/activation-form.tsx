"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound, LoaderCircle } from "lucide-react";
import type { ReactNode } from "react";
import { useForm } from "react-hook-form";

import { routes } from "@/shared/constants";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from "@/shared/ui";
import { Link } from "@/shared/ui/link";

import {
  activationPreflightStates,
  activationViewStates,
  classifyActivationFailure,
  getActivationViewState,
  orderActivationFormSchema,
  toOrderActivationInput,
  type ActivationPreflight,
  type OrderActivationFormValues,
} from "../lib";
import { useConfirmActivation, useValidateActivation } from "../model";

type OrderActivationProps = {
  token?: string;
};

export function OrderActivation({ token }: OrderActivationProps) {
  const normalizedToken = token?.trim() ?? "";
  const activation = useConfirmActivation(normalizedToken);
  const validation = useValidateActivation(normalizedToken);
  const {
    formState: { errors },
    handleSubmit,
    register,
  } = useForm<OrderActivationFormValues>({
    defaultValues: { password: "", passwordConfirm: "" },
    resolver: zodResolver(orderActivationFormSchema),
  });
  const preflight: ActivationPreflight = !normalizedToken
    ? activationPreflightStates.idle
    : validation.isFetching
      ? activationPreflightStates.pending
      : validation.error
        ? classifyActivationFailure(validation.error)
        : validation.validity?.valid
          ? activationPreflightStates.valid
          : activationPreflightStates.invalid;
  const confirmFailure = activation.error
    ? classifyActivationFailure(activation.error)
    : undefined;
  const viewState = getActivationViewState({
    confirmFailure,
    hasToken: Boolean(normalizedToken),
    preflight,
  });

  if (viewState === activationViewStates.invalid) {
    return <InvalidActivationLink />;
  }

  if (viewState === activationViewStates.loading) {
    return <ActivationLoading />;
  }

  if (viewState === activationViewStates.temporary) {
    return <TemporaryActivationFailure onRetry={() => void validation.refetch()} />;
  }

  return (
    <main className="bg-stone-50/60">
      <section className="container flex min-h-dvh items-center justify-center py-10">
        <Card className="w-full max-w-md">
          <CardHeader>
            <span className="mb-2 flex size-11 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
              <KeyRound className="size-5" />
            </span>
            <CardTitle>Завершите регистрацию</CardTitle>
            <CardDescription>Придумайте пароль для входа в личный кабинет.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-5"
              onSubmit={handleSubmit((values) =>
                activation.mutate(toOrderActivationInput(values, normalizedToken)),
              )}
            >
              <div className="space-y-2">
                <Label htmlFor="activation-password">Пароль</Label>
                <Input
                  id="activation-password"
                  type="password"
                  autoComplete="new-password"
                  aria-invalid={Boolean(errors.password)}
                  {...register("password")}
                />
                <FieldError message={errors.password?.message} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="activation-password-confirm">Повторите пароль</Label>
                <Input
                  id="activation-password-confirm"
                  type="password"
                  autoComplete="new-password"
                  aria-invalid={Boolean(errors.passwordConfirm)}
                  {...register("passwordConfirm")}
                />
                <FieldError message={errors.passwordConfirm?.message} />
              </div>
              {confirmFailure === activationViewStates.temporary ? (
                <p className="text-sm text-destructive" role="alert">
                  Не удалось завершить регистрацию. Попробуйте ещё раз.
                </p>
              ) : null}
              <Button type="submit" className="w-full" disabled={activation.isPending}>
                {activation.isPending ? (
                  <LoaderCircle data-icon="inline-start" className="animate-spin" />
                ) : null}
                Завершить регистрацию
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

function ActivationLoading() {
  return (
    <ActivationStateCard title="Проверяем ссылку">
      <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
        <LoaderCircle className="size-4 animate-spin" />
        Проверка ссылки для завершения регистрации...
      </div>
    </ActivationStateCard>
  );
}

function InvalidActivationLink() {
  return (
    <ActivationStateCard
      title="Ссылка недействительна или истекла"
      description="Запросите новую ссылку, чтобы восстановить доступ к аккаунту."
    >
      <Button asChild className="w-full">
        <Link href={routes.authRecovery}>Восстановить доступ</Link>
      </Button>
    </ActivationStateCard>
  );
}

function TemporaryActivationFailure({ onRetry }: { onRetry: () => void }) {
  return (
    <ActivationStateCard
      title="Не удалось проверить ссылку"
      description="Сервис временно недоступен. Попробуйте повторить проверку."
    >
      <Button type="button" className="w-full" onClick={onRetry}>
        Повторить
      </Button>
    </ActivationStateCard>
  );
}

function ActivationStateCard({
  children,
  description,
  title,
}: {
  children: ReactNode;
  description?: string;
  title: string;
}) {
  return (
    <main className="bg-stone-50/60">
      <section className="container flex min-h-dvh items-center justify-center py-10">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>{title}</CardTitle>
            {description ? <CardDescription>{description}</CardDescription> : null}
          </CardHeader>
          <CardContent>{children}</CardContent>
        </Card>
      </section>
    </main>
  );
}

function FieldError({ message }: { message?: string }) {
  return message ? (
    <p className="text-sm text-destructive" role="alert">
      {message}
    </p>
  ) : null;
}
