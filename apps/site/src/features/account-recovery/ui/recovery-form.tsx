"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle, Mail, RotateCcwKey } from "lucide-react";
import { useState } from "react";
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
  PersonalDataConsentCheckbox,
} from "@/shared/ui";
import { Link } from "@/shared/ui/link";

import { recoveryFormSchema, toRecoveryInput, type RecoveryFormValues } from "../lib/form";
import { useRequestRecovery } from "../model";

export function AccountRecovery() {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const {
    formState: { errors },
    handleSubmit,
    register,
    reset,
  } = useForm<RecoveryFormValues>({
    defaultValues: { email: "", acceptedPersonalDataConsent: false },
    resolver: zodResolver(recoveryFormSchema),
  });
  const recovery = useRequestRecovery({ onSuccess: () => setIsSubmitted(true) });

  return (
    <main className="bg-stone-50/60">
      <section className="container flex min-h-dvh items-center justify-center py-10">
        <Card className="w-full max-w-md">
          <CardHeader>
            <span className="mb-2 flex size-11 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
              <RotateCcwKey className="size-5" />
            </span>
            <CardTitle>Восстановление доступа</CardTitle>
            <CardDescription>
              Укажите email, который использовали при покупке или регистрации.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isSubmitted ? (
              <div className="space-y-4">
                <p className="rounded-lg border bg-muted/30 p-4 text-sm leading-6" role="status">
                  Если аккаунт связан с этим email, мы отправили инструкции для восстановления
                  доступа.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setIsSubmitted(false);
                    reset({ email: "", acceptedPersonalDataConsent: false });
                  }}
                >
                  Указать другой email
                </Button>
                <Button asChild variant="ghost" className="w-full">
                  <Link href={routes.auth}>Вернуться ко входу</Link>
                </Button>
              </div>
            ) : (
              <form
                className="space-y-5"
                onSubmit={handleSubmit((values) => recovery.mutate(toRecoveryInput(values)))}
              >
                <div className="space-y-2">
                  <Label htmlFor="recovery-email">Электронная почта</Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="recovery-email"
                      type="email"
                      autoComplete="email"
                      className="pl-9"
                      aria-invalid={Boolean(errors.email)}
                      {...register("email")}
                    />
                  </div>
                  <FieldError message={errors.email?.message} />
                </div>
                <div className="space-y-2">
                  <PersonalDataConsentCheckbox
                    id="recovery-personal-data-consent"
                    hasError={Boolean(errors.acceptedPersonalDataConsent)}
                    {...register("acceptedPersonalDataConsent")}
                  />
                  <FieldError message={errors.acceptedPersonalDataConsent?.message} />
                </div>
                {recovery.error ? (
                  <p className="text-sm text-destructive" role="alert">
                    Не удалось отправить инструкции. Попробуйте еще раз позднее.
                  </p>
                ) : null}
                <Button type="submit" className="w-full" disabled={recovery.isPending}>
                  {recovery.isPending ? (
                    <LoaderCircle data-icon="inline-start" className="animate-spin" />
                  ) : null}
                  Отправить инструкции
                </Button>
              </form>
            )}
          </CardContent>
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
