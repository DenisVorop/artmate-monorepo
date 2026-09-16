import { z } from "zod";

export const loginFormSchema = z.object({
  email: z.string().trim().email("Введите корректный email"),
  password: z.string().min(1, "Введите пароль"),
});

export type LoginFormValues = z.infer<typeof loginFormSchema>;

export const loginFormDefaultValues: LoginFormValues = {
  email: "",
  password: "",
};

export function toLoginInput(values: LoginFormValues) {
  return { email: values.email.trim(), password: values.password };
}

export function getAuthErrorMessage(status: number) {
  if (status === 401) {
    return "Неверный email или пароль.";
  }

  if (status === 429) {
    return "Слишком много попыток. Попробуйте немного позже.";
  }

  return "Не удалось войти. Проверьте соединение и попробуйте ещё раз.";
}
