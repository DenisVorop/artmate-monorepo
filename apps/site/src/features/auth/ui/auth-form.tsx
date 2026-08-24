"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Check,
  ExternalLink,
  KeyRound,
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
  PersonalDataConsentCheckbox,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/shared/ui";
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "@/shared/ui/input-otp";
import { Link } from "@/shared/ui/link";

import {
  confirmPasswordResetFormSchema,
  emailVerificationFormSchema,
  getAuthErrorMessage,
  getSafeAuthRedirectPath,
  loginFormSchema,
  passwordResetRequestFormSchema,
  registerFormSchema,
  toConfirmPasswordResetInput,
  toEmailVerificationInput,
  toLoginInput,
  toPasswordResetRequestInput,
  toRegisterInput,
  type ConfirmPasswordResetFormValues,
  type EmailVerificationFormValues,
  type LoginFormValues,
  type PasswordResetRequestFormValues,
  type RegisterFormValues,
} from "../lib";
import {
  useConfirmEmailVerificationMutation,
  useConfirmPasswordResetMutation,
  useLoginMutation,
  useRegisterMutation,
  useRequestPasswordResetMutation,
  useResendEmailVerificationMutation,
} from "../model";

type AuthMode = "login" | "register";

type AuthFormProps = {
  embedded?: boolean;
  initialEmail?: string;
  initialName?: string;
  isEmailLocked?: boolean;
  showNameOptionalHint?: boolean;
  onAuthenticated?: () => void;
};

export function AuthForm({
  embedded = false,
  initialEmail,
  initialName,
  isEmailLocked = false,
  showNameOptionalHint = true,
  onAuthenticated,
}: AuthFormProps = {}) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [verificationState, setVerificationState] = useState<AuthEmailVerificationStateDTO>();
  const [isPasswordResetRequested, setIsPasswordResetRequested] = useState(false);
  const lockedEmail = isEmailLocked && initialEmail?.trim() ? initialEmail.trim() : undefined;
  const description = isPasswordResetRequested
    ? lockedEmail
      ? "Отправим ссылку для смены пароля на почту из формы заказа."
      : "Укажите email, и мы отправим ссылку для смены пароля."
    : verificationState
      ? "Введите код из письма, чтобы завершить вход."
      : "Войдите или создайте аккаунт, чтобы сохранять заказы и персональные данные.";
  const content = verificationState ? (
    <EmailVerificationForm
      onAuthenticated={onAuthenticated}
      onBack={() => setVerificationState(undefined)}
      onVerificationChange={setVerificationState}
      verification={verificationState}
    />
  ) : isPasswordResetRequested ? (
    <PasswordResetRequestForm
      initialEmail={initialEmail}
      lockedEmail={lockedEmail}
      onBack={() => setIsPasswordResetRequested(false)}
    />
  ) : (
    <Tabs value={mode} onValueChange={(value) => setMode(value as AuthMode)}>
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="login">Вход</TabsTrigger>
        <TabsTrigger value="register">Регистрация</TabsTrigger>
      </TabsList>

      <TabsContent value="login" className="mt-4">
        <LoginForm
          hideOAuth={embedded}
          initialEmail={initialEmail}
          lockedEmail={lockedEmail}
          onAuthenticated={onAuthenticated}
          onPasswordReset={() => setIsPasswordResetRequested(true)}
          onVerificationRequired={setVerificationState}
        />
      </TabsContent>

      <TabsContent value="register" className="mt-4">
        <RegisterForm
          hideOAuth={embedded}
          initialEmail={initialEmail}
          initialName={initialName}
          lockedEmail={lockedEmail}
          showNameOptionalHint={showNameOptionalHint}
          onVerificationRequired={setVerificationState}
        />
      </TabsContent>
    </Tabs>
  );

  if (embedded) {
    return (
      <div className="w-full space-y-4">
        <p className="text-sm text-muted-foreground">{description}</p>
        {content}
      </div>
    );
  }

  return (
    <Card className="w-full max-w-md shadow-xl shadow-stone-950/5">
      <CardHeader>
        <CardTitle className="text-xl">Аккаунт Artmate</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}

function LoginForm({
  hideOAuth,
  initialEmail,
  lockedEmail,
  onAuthenticated,
  onPasswordReset,
  onVerificationRequired,
}: {
  readonly hideOAuth: boolean;
  readonly initialEmail?: string;
  readonly lockedEmail?: string;
  readonly onAuthenticated?: () => void;
  readonly onPasswordReset: () => void;
  readonly onVerificationRequired: (_verification: AuthEmailVerificationStateDTO) => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [submitError, setSubmitError] = useState<string>();
  const redirectPath = useMemo(
    () => getSafeAuthRedirectPath(searchParams.get("next")),
    [searchParams],
  );
  const { mutate: login, isPending } = useLoginMutation({
    onSuccess: completeAuthentication,
  });
  const { mutate: resendEmailVerification, isPending: isSendingVerification } =
    useResendEmailVerificationMutation();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    defaultValues: {
      email: lockedEmail ?? initialEmail ?? "",
      password: "",
    },
    mode: "onSubmit",
    resolver: zodResolver(loginFormSchema),
  });
  const isSubmitting = isPending || isSendingVerification;

  const submitForm = handleSubmit((values) => {
    setSubmitError(undefined);
    const email = lockedEmail ?? values.email.trim();

    login(toLoginInput({ ...values, email }), {
      onError: (error) => {
        if (isEmailNotVerifiedError(error)) {
          sendVerificationCode(email);
          return;
        }

        setSubmitError(getAuthErrorMessage(error));
      },
    });
  });

  function completeAuthentication() {
    if (onAuthenticated) {
      onAuthenticated();
      return;
    }

    router.replace(redirectPath);
    router.refresh();
  }

  function sendVerificationCode(email: string) {
    resendEmailVerification(
      { email },
      {
        onSuccess: (response) => {
          if (!response) {
            setSubmitError("Не удалось отправить код подтверждения.");
            return;
          }

          onVerificationRequired(response.verification);
        },
        onError: (error) => {
          const resendAvailableAt = getEmailVerificationResendAvailableAt(error);

          if (resendAvailableAt) {
            onVerificationRequired({
              email,
              resendAvailableAt,
            });
            return;
          }

          setSubmitError(getAuthErrorMessage(error));
        },
      },
    );
  }

  return (
    <form onSubmit={submitForm} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="auth-email">Email</Label>
        <Input
          id="auth-email"
          type="email"
          autoComplete="email"
          readOnly={Boolean(lockedEmail)}
          aria-invalid={Boolean(errors.email)}
          className={lockedEmail ? "bg-muted/50 text-muted-foreground" : undefined}
          {...register("email")}
        />
        <FieldError message={errors.email?.message} />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="auth-password">Пароль</Label>
          <Button
            type="button"
            variant="link"
            className="h-auto px-0 text-xs"
            onClick={onPasswordReset}
          >
            <KeyRound data-icon="inline-start" />
            Забыли пароль?
          </Button>
        </div>
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

      {!hideOAuth && <OAuthButton />}
    </form>
  );
}

function PasswordResetRequestForm({
  initialEmail,
  lockedEmail,
  onBack,
}: {
  readonly initialEmail?: string;
  readonly lockedEmail?: string;
  readonly onBack: () => void;
}) {
  const [submitError, setSubmitError] = useState<string>();
  const [isSent, setIsSent] = useState(false);
  const { mutate: requestPasswordReset, isPending } = useRequestPasswordResetMutation();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PasswordResetRequestFormValues>({
    defaultValues: {
      acceptedPersonalDataConsent: false,
      email: lockedEmail ?? initialEmail ?? "",
    },
    mode: "onSubmit",
    resolver: zodResolver(passwordResetRequestFormSchema),
  });

  const submitForm = handleSubmit((values) => {
    setSubmitError(undefined);

    requestPasswordReset(
      toPasswordResetRequestInput({ ...values, email: lockedEmail ?? values.email }),
      {
        onSuccess: () => setIsSent(true),
        onError: (error) => setSubmitError(getAuthErrorMessage(error)),
      },
    );
  });

  if (isSent) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          <MailCheck data-icon="inline-start" aria-hidden="true" />
          Если аккаунт найден, мы отправили письмо со ссылкой для смены пароля.
        </div>

        <Button type="button" variant="outline" className="h-10 w-full" onClick={onBack}>
          <ArrowLeft data-icon="inline-start" />
          Вернуться ко входу
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submitForm} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="password-reset-email">Email</Label>
        <Input
          id="password-reset-email"
          type="email"
          autoComplete="email"
          readOnly={Boolean(lockedEmail)}
          aria-invalid={Boolean(errors.email)}
          className={lockedEmail ? "bg-muted/50 text-muted-foreground" : undefined}
          {...register("email")}
        />
        <FieldError message={errors.email?.message} />
      </div>

      <FormError message={submitError} />

      <div className="space-y-2">
        <PersonalDataConsentCheckbox
          id="password-reset-personal-data-consent"
          hasError={Boolean(errors.acceptedPersonalDataConsent)}
          {...register("acceptedPersonalDataConsent")}
        />
        <FieldError message={errors.acceptedPersonalDataConsent?.message} />
      </div>

      <Button type="submit" disabled={isPending} className="h-10 w-full">
        {isPending ? (
          <LoaderCircle data-icon="inline-start" className="animate-spin" />
        ) : (
          <KeyRound data-icon="inline-start" />
        )}
        Отправить ссылку
      </Button>

      <Button type="button" variant="ghost" className="h-10 w-full" onClick={onBack}>
        <ArrowLeft data-icon="inline-start" />
        Назад
      </Button>
    </form>
  );
}

export function PasswordResetForm({ token }: { readonly token?: string }) {
  const normalizedToken = token?.trim();
  const [submitError, setSubmitError] = useState<string>();
  const [isReset, setIsReset] = useState(false);
  const { mutate: confirmPasswordReset, isPending } = useConfirmPasswordResetMutation();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ConfirmPasswordResetFormValues>({
    defaultValues: {
      password: "",
      passwordConfirm: "",
    },
    mode: "onSubmit",
    resolver: zodResolver(confirmPasswordResetFormSchema),
  });

  const submitForm = handleSubmit((values) => {
    if (!normalizedToken) {
      return;
    }

    setSubmitError(undefined);

    confirmPasswordReset(toConfirmPasswordResetInput(normalizedToken, values), {
      onSuccess: () => setIsReset(true),
      onError: (error) => setSubmitError(getAuthErrorMessage(error)),
    });
  });

  return (
    <Card className="w-full max-w-md shadow-xl shadow-stone-950/5">
      <CardHeader>
        <CardTitle className="text-xl">Смена пароля</CardTitle>
        <CardDescription>
          {isReset
            ? "Пароль обновлен. Теперь можно войти с новым паролем."
            : "Задайте новый пароль для аккаунта Artmate."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!normalizedToken ? (
          <div className="space-y-4">
            <FormError message="Ссылка для смены пароля недействительна или устарела." />
            <Button asChild className="h-10 w-full">
              <Link href={routes.auth}>
                <KeyRound data-icon="inline-start" />
                Запросить новую ссылку
              </Link>
            </Button>
          </div>
        ) : isReset ? (
          <div className="space-y-4">
            <FormMessage message="Пароль успешно обновлен." />
            <Button asChild className="h-10 w-full">
              <Link href={routes.auth}>
                <LogIn data-icon="inline-start" />
                Войти
              </Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={submitForm} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reset-password">Новый пароль</Label>
              <Input
                id="reset-password"
                type="password"
                autoComplete="new-password"
                aria-invalid={Boolean(errors.password)}
                {...register("password")}
              />
              <FieldError message={errors.password?.message} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reset-password-confirm">Повторите пароль</Label>
              <Input
                id="reset-password-confirm"
                type="password"
                autoComplete="new-password"
                aria-invalid={Boolean(errors.passwordConfirm)}
                {...register("passwordConfirm")}
              />
              <FieldError message={errors.passwordConfirm?.message} />
            </div>

            <FormError message={submitError} />

            <Button type="submit" disabled={isPending} className="h-10 w-full">
              {isPending ? (
                <LoaderCircle data-icon="inline-start" className="animate-spin" />
              ) : (
                <KeyRound data-icon="inline-start" />
              )}
              Сменить пароль
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

function RegisterForm({
  hideOAuth,
  initialEmail,
  initialName,
  lockedEmail,
  showNameOptionalHint,
  onVerificationRequired,
}: {
  readonly hideOAuth: boolean;
  readonly initialEmail?: string;
  readonly initialName?: string;
  readonly lockedEmail?: string;
  readonly showNameOptionalHint: boolean;
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
      acceptedPersonalDataConsent: false,
      email: lockedEmail ?? initialEmail ?? "",
      name: initialName?.trim() ?? "",
      password: "",
      passwordConfirm: "",
    },
    mode: "onSubmit",
    resolver: zodResolver(registerFormSchema),
  });
  const isSubmitting = isPending;

  const submitForm = handleSubmit((values) => {
    setSubmitError(undefined);

    registerUser(toRegisterInput({ ...values, email: lockedEmail ?? values.email }), {
      onSuccess: (response) => {
        if (!response) {
          setSubmitError("Не удалось получить код подтверждения.");
          return;
        }

        onVerificationRequired(response.verification);
      },
      onError: (error) => setSubmitError(getAuthErrorMessage(error)),
    });
  });

  return (
    <form onSubmit={submitForm} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="register-name">
          Имя{" "}
          {showNameOptionalHint && <span className="text-muted-foreground">(необязательно)</span>}
        </Label>
        <Input id="register-name" type="text" autoComplete="name" {...register("name")} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="register-email">Email</Label>
        <Input
          id="register-email"
          type="email"
          autoComplete="email"
          readOnly={Boolean(lockedEmail)}
          aria-invalid={Boolean(errors.email)}
          className={lockedEmail ? "bg-muted/50 text-muted-foreground" : undefined}
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

      <div className="space-y-2">
        <PersonalDataConsentCheckbox
          id="register-personal-data-consent"
          hasError={Boolean(errors.acceptedPersonalDataConsent)}
          {...register("acceptedPersonalDataConsent")}
        />
        <FieldError message={errors.acceptedPersonalDataConsent?.message} />
      </div>

      <p className="text-xs leading-5 text-muted-foreground">
        Создавая аккаунт, вы принимаете условия{" "}
        <Link
          href={routes.legal.publicOffer}
          target="_blank"
          rel="noreferrer"
          aria-label="Публичная оферта (откроется в новой вкладке)"
          className="text-foreground underline underline-offset-4"
        >
          публичной оферты
        </Link>
        .
      </p>

      <Button type="submit" disabled={isSubmitting} className="h-10 w-full">
        {isSubmitting ? (
          <LoaderCircle data-icon="inline-start" className="animate-spin" />
        ) : (
          <UserPlus data-icon="inline-start" />
        )}
        Создать аккаунт
      </Button>

      {!hideOAuth && <OAuthButton />}
    </form>
  );
}

function EmailVerificationForm({
  onAuthenticated,
  onBack,
  onVerificationChange,
  verification,
}: {
  readonly onAuthenticated?: () => void;
  readonly onBack: () => void;
  readonly onVerificationChange: (_verification: AuthEmailVerificationStateDTO) => void;
  readonly verification: AuthEmailVerificationStateDTO;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [submitError, setSubmitError] = useState<string>();
  const [submitMessage, setSubmitMessage] = useState<string>();
  const [now, setNow] = useState(() => Date.now());
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
  const { mutate: confirmEmailVerification, isPending: isConfirming } =
    useConfirmEmailVerificationMutation({
      onSuccess: completeAuthentication,
    });
  const resendWaitSeconds = getWaitSeconds(verification.resendAvailableAt, now);
  const isResendDisabled = isResending || resendWaitSeconds > 0;

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(Date.now()), 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  const submitForm = handleSubmit((values) => {
    setSubmitError(undefined);
    setSubmitMessage(undefined);

    confirmEmailVerification(toEmailVerificationInput(verification.email, values), {
      onError: (error) => setSubmitError(getAuthErrorMessage(error)),
    });
  });

  function completeAuthentication() {
    if (onAuthenticated) {
      onAuthenticated();
      return;
    }

    router.replace(redirectPath);
    router.refresh();
  }

  function resendCode() {
    setSubmitError(undefined);
    setSubmitMessage(undefined);

    resendEmailVerification(
      {
        email: verification.email,
      },
      {
        onSuccess: (response) => {
          if (!response) {
            setSubmitError("Не удалось отправить новый код.");
            return;
          }

          onVerificationChange({
            ...verification,
            ...response.verification,
            emailMasked: response.verification.emailMasked ?? verification.emailMasked,
          });
          setNow(Date.now());
          setSubmitMessage("Новый код отправлен.");
        },
        onError: (error) => setSubmitError(getAuthErrorMessage(error)),
      },
    );
  }

  return (
    <form onSubmit={submitForm} className="space-y-4">
      <div className="rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
        <MailCheck data-icon="inline-start" aria-hidden="true" />
        {`Код отправлен на ${verification.email}`}
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

function getEmailVerificationResendAvailableAt(error: unknown) {
  const message = error instanceof Error ? error.message : "";

  if (!message.startsWith("Email verification code resend is temporarily unavailable")) {
    return undefined;
  }

  const retryAfterSeconds = getRetryAfterSeconds(message) ?? 60;

  return new Date(Date.now() + retryAfterSeconds * 1000).toISOString();
}

function getRetryAfterSeconds(message: string) {
  const match = message.match(/Retry after (?<seconds>\d+) seconds$/);
  const seconds = Number(match?.groups?.seconds);

  return Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : undefined;
}

function getWaitSeconds(value: string, now: number) {
  const timestamp = new Date(value).getTime();

  if (!Number.isFinite(timestamp)) {
    return 0;
  }

  return Math.max(0, Math.ceil((timestamp - now) / 1000));
}
