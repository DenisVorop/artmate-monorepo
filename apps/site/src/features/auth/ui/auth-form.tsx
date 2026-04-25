"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ExternalLink, LoaderCircle, LogIn, UserPlus, UserRound } from "lucide-react";
import { useForm } from "react-hook-form";

import { useUser, type AuthUser } from "@/entities/session";
import type { LoginInputDTO, RegisterInputDTO } from "@/shared/actions/auth";
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
import { Link } from "@/shared/ui/link";

import { getAuthErrorMessage } from "../lib";
import { useLoginMutation, useLogoutMutation, useRegisterMutation } from "../model";

type AuthMode = "login" | "register";

type RegisterFormValues = RegisterInputDTO & {
  passwordConfirm: string;
};

export function AuthForm() {
  const [mode, setMode] = useState<AuthMode>("login");
  const user = useUser();

  if (user) {
    return <AuthenticatedPanel user={user} />;
  }

  return (
    <Card className="w-full max-w-md shadow-xl shadow-stone-950/5">
      <CardHeader>
        <CardTitle className="text-xl">Аккаунт Artmate</CardTitle>
        <CardDescription>
          Войдите или создайте аккаунт, чтобы сохранять заказы и персональные данные.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={mode} onValueChange={(value) => setMode(value as AuthMode)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Вход</TabsTrigger>
            <TabsTrigger value="register">Регистрация</TabsTrigger>
          </TabsList>

          <TabsContent value="login" className="mt-4">
            <LoginForm />
          </TabsContent>

          <TabsContent value="register" className="mt-4">
            <RegisterForm />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [submitError, setSubmitError] = useState<string>();
  const { mutate: login, isPending } = useLoginMutation();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInputDTO>({
    defaultValues: {
      login: "",
      password: "",
    },
    mode: "onSubmit",
  });
  const isSubmitting = isPending;
  const redirectPath = useMemo(() => getSafeRedirectPath(searchParams.get("next")), [searchParams]);

  const submitForm = handleSubmit(async (values) => {
    setSubmitError(undefined);

    try {
      await login(values);
      router.replace(redirectPath);
      router.refresh();
    } catch (error) {
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
          {...register("login", {
            required: "Укажите логин",
            minLength: {
              value: 3,
              message: "Логин должен быть длиннее 2 символов",
            },
          })}
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
          {...register("password", {
            required: "Укажите пароль",
          })}
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

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [submitError, setSubmitError] = useState<string>();
  const { mutate: registerUser, isPending } = useRegisterMutation();
  const {
    register,
    handleSubmit,
    watch,
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
  });
  const password = watch("password");
  const isSubmitting = isPending;
  const redirectPath = useMemo(() => getSafeRedirectPath(searchParams.get("next")), [searchParams]);

  const submitForm = handleSubmit(async (values) => {
    setSubmitError(undefined);

    try {
      await registerUser({
        login: values.login,
        password: values.password,
        email: getOptionalValue(values.email),
        name: getOptionalValue(values.name),
      });
      router.replace(redirectPath);
      router.refresh();
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
          {...register("login", {
            required: "Укажите логин",
            minLength: {
              value: 3,
              message: "Логин должен быть длиннее 2 символов",
            },
          })}
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
        <Label htmlFor="register-email">
          Email <span className="text-muted-foreground">(необязательно)</span>
        </Label>
        <Input
          id="register-email"
          type="email"
          autoComplete="email"
          aria-invalid={Boolean(errors.email)}
          {...register("email", {
            pattern: {
              value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
              message: "Введите корректный email",
            },
          })}
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
          {...register("password", {
            required: "Укажите пароль",
            minLength: {
              value: 8,
              message: "Пароль должен быть не короче 8 символов",
            },
          })}
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
          {...register("passwordConfirm", {
            validate: (value) => value === password || "Пароли не совпадают",
          })}
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

function AuthenticatedPanel({ user }: { user: AuthUser }) {
  const router = useRouter();
  const { mutate: logout, isPending } = useLogoutMutation();
  const title = user.name ?? user.email ?? user.providerUserId;

  async function handleLogout() {
    await logout();
    router.replace(routes.home);
    router.refresh();
  }

  return (
    <Card className="w-full max-w-md shadow-xl shadow-stone-950/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <UserRound className="size-5" />
          {title}
        </CardTitle>
        <CardDescription>{user.email ?? "Аккаунт Artmate"}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <Button asChild variant="outline" className="h-10 w-full">
          <Link href={routes.home}>На главную</Link>
        </Button>
        <Button
          type="button"
          variant="destructive"
          disabled={isPending}
          className="h-10 w-full"
          onClick={() => void handleLogout()}
        >
          {isPending && <LoaderCircle data-icon="inline-start" className="animate-spin" />}
          Выйти
        </Button>
      </CardContent>
    </Card>
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

function getOptionalValue(value?: string) {
  const normalizedValue = value?.trim();

  return normalizedValue ? normalizedValue : undefined;
}

function getSafeRedirectPath(path: string | null) {
  if (!path || !path.startsWith("/") || path.startsWith("//")) {
    return routes.home;
  }

  return path;
}
