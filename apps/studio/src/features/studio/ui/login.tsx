"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginValues } from "../lib/schema";
import { ArrowRight, LoaderCircle, Palette } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { useLogin } from "../model/use-login";
export function Login() {
  const login = useLogin();
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { password: "" },
  });
  return (
    <main className="login-page">
      <div className="login-card">
        <span className="brand-mark">
          <Palette size={25} />
        </span>
        <p className="eyebrow">ARTMATE STUDIO</p>
        <h1>
          У каждой картинки
          <br />
          есть своя палитра.
        </h1>
        <p className="muted">
          Войдите, чтобы превратить изображение в раскраску по номерам.
        </p>
        <form
          onSubmit={form.handleSubmit(({ password }) => login.mutate(password))}
        >
          <Label htmlFor="password">Пароль студии</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            {...form.register("password")}
            className="mt-2 h-11"
          />
          {(form.formState.errors.password || login.error) && (
            <p role="alert" className="error">
              {form.formState.errors.password?.message || login.error?.message}
            </p>
          )}
          <Button className="mt-5 h-11 w-full" disabled={login.isPending}>
            {login.isPending ? (
              <LoaderCircle className="animate-spin" />
            ) : (
              <ArrowRight />
            )}{" "}
            Войти
          </Button>
        </form>
        <div className="login-palette" aria-hidden="true">
          {[
            "#183e48",
            "#497d83",
            "#bbd2c6",
            "#f7cf8c",
            "#d97b54",
            "#985b55",
          ].map((c) => (
            <span key={c} style={{ background: c }} />
          ))}
        </div>
      </div>
    </main>
  );
}
