"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Check,
  ExternalLink,
  LoaderCircle,
  LogIn,
  MailCheck,
  RotateCw,
  UserPlus,
} from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import { Controller, useForm } from "react-hook-form";

import type { AuthEmailVerificationStateDTO } from "@/shared/actions/auth";
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/shared/ui";
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "@/shared/ui/input-otp";
import { Link } from "@/shared/ui/link";

import {
  emailVerificationFormSchema,
  getAuthErrorMessage,
  getSafeAuthRedirectPath,
  loginFormSchema,
  registerFormSchema,
  toEmailVerificationInput,
  toLoginInput,
  toRegisterInput,
  type EmailVerificationFormValues,
  type LoginFormValues,
  type RegisterFormValues,
} from "../lib";
import {
  useConfirmEmailVerificationMutation,
  useLoginMutation,
  useRegisterMutation,
  useResendEmailVerificationMutation,
} from "../model";

type AuthMode = "login" | "register";

export function AuthForm() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [verificationState, setVerificationState] = useState<AuthEmailVerificationStateDTO>();

  return (
    <Card className="w-full max-w-md shadow-xl shadow-stone-950/5">
      <CardHeader>
        <CardTitle className="text-xl">Аккаунт Artmate</CardTitle>
        <CardDescription>
          {verificationState
            ? "Введите код из письма, чтобы завершить вход."
            : "Войдите или создайте аккаунт, чтобы сохранять заказы и персональные данные."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {verificationState ? (
          <EmailVerificationForm
            onBack={() => setVerificationState(undefined)}
            onVerificationChange={setVerificationState}
            verification={verificationState}
          />
        ) : (
          <Tabs value={mode} onValueChange={(value) => setMode(value as AuthMode)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Вход</TabsTrigger>
              <TabsTrigger value="register">Регистрация</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="mt-4">
              <LoginForm onVerificationRequired={setVerificationState} />
            </TabsContent>

            <TabsContent value="register" className="mt-4">
              <RegisterForm onVerificationRequired={setVerificationState} />
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}

function LoginForm({
  onVerificationRequired,
}: {
  readonly onVerificationRequired: (_verification: AuthEmailVerificationStateDTO) => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [submitError, setSubmitError] = useState<string>();
  const { mutate: login, isPending } = useLoginMutation();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    defaultValues: {
      login: "",
      password: "",
    },
    mode: "onSubmit",
    resolver: zodResolver(loginFormSchema),
  });
  const isSubmitting = isPending;
  const redirectPath = useMemo(
    () => getSafeAuthRedirectPath(searchParams.get("next")),
    [searchParams],
  );

  const submitForm = handleSubmit(async (values) => {
    setSubmitError(undefined);

    try {
      await login(toLoginInput(values));
      router.replace(redirectPath);
      router.refresh();
    } catch (error) {
      if (isEmailNotVerifiedError(error)) {
        onVerificationRequired({
          login: values.login.trim(),
          resendAvailableAt: new Date().toISOString(),
        });
        return;
      }

      setSubmitError(getAuthErrorMessage(error));
    }
  });

  return (
    <form onSubmit={submitForm} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="auth-login">Логин</Label>
        <Input
          id="auth-login"
          type="text"
          autoComplete="username"
          aria-invalid={Boolean(errors.login)}
          {...register("login")}
        />
        <FieldError message={errors.login?.message} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="auth-password">Пароль</Label>
        <Input
          id="auth-password"
          type="password"
          autoComplete="current-password"
          aria-invalid={Boolean(errors.password)}
          {...register("password")}
        />
        <FieldError message={errors.password?.message} />
      </div>

      <FormError message={submitError} />

      <Button type="submit" disabled={isSubmitting} className="h-10 w-full">
        {isSubmitting ? (
          <LoaderCircle data-icon="inline-start" className="animate-spin" />
        ) : (
          <LogIn data-icon="inline-start" />
        )}
        Войти
      </Button>

      <OAuthButton />
    </form>
  );
}

function RegisterForm({
  onVerificationRequired,
}: {
  readonly onVerificationRequired: (_verification: AuthEmailVerificationStateDTO) => void;
}) {
  const [submitError, setSubmitError] = useState<string>();
  const { mutate: registerUser, isPending } = useRegisterMutation();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    defaultValues: {
      login: "",
      email: "",
      name: "",
      password: "",
      passwordConfirm: "",
    },
    mode: "onSubmit",
    resolver: zodResolver(registerFormSchema),
  });
  const isSubmitting = isPending;

  const submitForm = handleSubmit(async (values) => {
    setSubmitError(undefined);

    try {
      const response = await registerUser(toRegisterInput(values));

      if (!response) {
        throw new Error("Verification response is empty");
      }

      onVerificationRequired(response.verification);
    } catch (error) {
      setSubmitError(getAuthErrorMessage(error));
    }
  });

  return (
    <form onSubmit={submitForm} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="register-login">Логин</Label>
        <Input
          id="register-login"
          type="text"
          autoComplete="username"
          aria-invalid={Boolean(errors.login)}
          {...register("login")}
        />
        <FieldError message={errors.login?.message} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="register-name">
          Имя <span className="text-muted-foreground">(необязательно)</span>
        </Label>
        <Input id="register-name" type="text" autoComplete="name" {...register("name")} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="register-email">Email</Label>
        <Input
          id="register-email"
          type="email"
          autoComplete="email"
          aria-invalid={Boolean(errors.email)}
          {...register("email")}
        />
        <FieldError message={errors.email?.message} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="register-password">Пароль</Label>
        <Input
          id="register-password"
          type="password"
          autoComplete="new-password"
          aria-invalid={Boolean(errors.password)}
          {...register("password")}
        />
        <FieldError message={errors.password?.message} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="register-password-confirm">Повторите пароль</Label>
        <Input
          id="register-password-confirm"
          type="password"
          autoComplete="new-password"
          aria-invalid={Boolean(errors.passwordConfirm)}
          {...register("passwordConfirm")}
        />
        <FieldError message={errors.passwordConfirm?.message} />
      </div>

      <FormError message={submitError} />

      <Button type="submit" disabled={isSubmitting} className="h-10 w-full">
        {isSubmitting ? (
          <LoaderCircle data-icon="inline-start" className="animate-spin" />
        ) : (
          <UserPlus data-icon="inline-start" />
        )}
        Создать аккаунт
      </Button>

      <OAuthButton />
    </form>
  );
}

function EmailVerificationForm({
  onBack,
  onVerificationChange,
  verification,
}: {
  readonly onBack: () => void;
  readonly onVerificationChange: (_verification: AuthEmailVerificationStateDTO) => void;
  readonly verification: AuthEmailVerificationStateDTO;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [submitError, setSubmitError] = useState<string>();
  const [submitMessage, setSubmitMessage] = useState<string>();
  const [now, setNow] = useState(() => Date.now());
  const { mutate: confirmEmailVerification, isPending: isConfirming } =
    useConfirmEmailVerificationMutation();
  const { mutate: resendEmailVerification, isPending: isResending } =
    useResendEmailVerificationMutation();
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<EmailVerificationFormValues>({
    defaultValues: {
      code: "",
    },
    mode: "onSubmit",
    resolver: zodResolver(emailVerificationFormSchema),
  });
  const redirectPath = useMemo(
    () => getSafeAuthRedirectPath(searchParams.get("next")),
    [searchParams],
  );
  const resendWaitSeconds = getWaitSeconds(verification.resendAvailableAt, now);
  const isResendDisabled = isResending || resendWaitSeconds > 0;

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(Date.now()), 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  const submitForm = handleSubmit(async (values) => {
    setSubmitError(undefined);
    setSubmitMessage(undefined);

    try {
      await confirmEmailVerification(toEmailVerificationInput(verification.login, values));
      router.replace(redirectPath);
      router.refresh();
    } catch (error) {
      setSubmitError(getAuthErrorMessage(error));
    }
  });

  async function resendCode() {
    setSubmitError(undefined);
    setSubmitMessage(undefined);

    try {
      const response = await resendEmailVerification({
        login: verification.login,
      });

      if (!response) {
        throw new Error("Verification response is empty");
      }

      onVerificationChange({
        ...verification,
        ...response.verification,
        emailMasked: response.verification.emailMasked ?? verification.emailMasked,
      });
      setNow(Date.now());
      setSubmitMessage("Новый код отправлен.");
    } catch (error) {
      setSubmitError(getAuthErrorMessage(error));
    }
  }

  return (
    <form onSubmit={submitForm} className="space-y-4">
      <div className="rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
        <MailCheck data-icon="inline-start" aria-hidden="true" />
        {verification.emailMasked
          ? `Код отправлен на ${verification.emailMasked}`
          : "Код отправлен на почту аккаунта"}
      </div>

      <div className="space-y-2">
        <Label htmlFor="email-verification-code">Код из письма</Label>
        <Controller
          control={control}
          name="code"
          render={({ field }) => (
            <InputOTP
              id="email-verification-code"
              maxLength={6}
              pattern={REGEXP_ONLY_DIGITS}
              aria-invalid={Boolean(errors.code)}
              containerClassName="justify-center"
              {...field}
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} className="size-10 text-base" />
                <InputOTPSlot index={1} className="size-10 text-base" />
                <InputOTPSlot index={2} className="size-10 text-base" />
              </InputOTPGroup>
              <InputOTPSeparator />
              <InputOTPGroup>
                <InputOTPSlot index={3} className="size-10 text-base" />
                <InputOTPSlot index={4} className="size-10 text-base" />
                <InputOTPSlot index={5} className="size-10 text-base" />
              </InputOTPGroup>
            </InputOTP>
          )}
        />
        <FieldError message={errors.code?.message} />
      </div>

      <FormMessage message={submitMessage} />
      <FormError message={submitError} />

      <Button type="submit" disabled={isConfirming} className="h-10 w-full">
        {isConfirming ? (
          <LoaderCircle data-icon="inline-start" className="animate-spin" />
        ) : (
          <Check data-icon="inline-start" />
        )}
        Подтвердить
      </Button>

      <div className="grid gap-2 sm:grid-cols-2">
        <Button type="button" variant="outline" disabled={isResendDisabled} onClick={resendCode}>
          {isResending ? (
            <LoaderCircle data-icon="inline-start" className="animate-spin" />
          ) : (
            <RotateCw data-icon="inline-start" />
          )}
          {resendWaitSeconds > 0 ? `Повторить через ${resendWaitSeconds} с` : "Отправить снова"}
        </Button>

        <Button type="button" variant="ghost" onClick={onBack}>
          Изменить данные
        </Button>
      </div>
    </form>
  );
}

function OAuthButton() {
  return (
    <Button asChild variant="outline" className="h-10 w-full">
      <Link href={routes.authOAuth("yandex")}>
        <ExternalLink data-icon="inline-start" />
        Войти через Яндекс ID
      </Link>
    </Button>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="text-sm text-destructive">{message}</p>;
}

function FormError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return (
    <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {message}
    </div>
  );
}

function FormMessage({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
      {message}
    </div>
  );
}

function isEmailNotVerifiedError(error: unknown) {
  return error instanceof Error && error.message === "Email is not verified";
}

function getWaitSeconds(value: string, now: number) {
  const timestamp = new Date(value).getTime();

  if (!Number.isFinite(timestamp)) {
    return 0;
  }

  return Math.max(0, Math.ceil((timestamp - now) / 1000));
}
