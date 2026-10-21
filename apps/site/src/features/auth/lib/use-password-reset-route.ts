"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { routes } from "@/shared/constants";
import { useConfirmRecoveryPassword } from "../model/use-confirm-recovery-password";
import { passwordCreationSchema, type PasswordCreationValues } from "./flow-form-values";

export function usePasswordResetRoute(token?: string) {
  const router = useRouter();
  // Keep only this mounted document's capability when cleanup refreshes RSC props.
  const capability = useRef(token);
  const [isReset, setIsReset] = useState(false);
  const [error, setError] = useState<string>();
  const mounted = useRef(true);
  const submitting = useRef(false);
  useLayoutEffect(() => {
    window.history.replaceState(null, "", routes.authResetPassword);
    router.replace(routes.authResetPassword, { scroll: false });
  }, [router]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const form = useForm<PasswordCreationValues>({
    resolver: zodResolver(passwordCreationSchema),
    defaultValues: { password: "", passwordConfirm: "" },
  });
  const { mutateAsync, isPending } = useConfirmRecoveryPassword();
  const { reset } = form;
  const submit = form.handleSubmit(async (values) => {
    const currentToken = capability.current;
    if (!currentToken || submitting.current) return;
    submitting.current = true;
    setError(undefined);
    try {
      const result = await mutateAsync({ token: currentToken, ...values });
      if (!mounted.current) return;
      if (!result?.ok) throw new Error("Password reset result is unavailable");
      capability.current = undefined;
      reset();
      setIsReset(true);
    } catch {
      if (!mounted.current) return;
      setError("Не удалось сменить пароль. Попробуйте снова.");
    } finally {
      submitting.current = false;
    }
  });
  return {
    register: form.register,
    errors: form.formState.errors,
    submit,
    isPending,
    isReset,
    hasToken: Boolean(capability.current),
    error,
  };
}
