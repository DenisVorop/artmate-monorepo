"use client";

import { CheckCircle2, Send } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useId, useState } from "react";
import { useForm } from "react-hook-form";

import { cn } from "@/shared/lib";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Textarea,
} from "@/shared/ui";

import {
  contactFormDefaultValues,
  contactFormSchema,
  type ContactFormValues,
} from "../lib";
import { useSubmitContactMessageMutation } from "../model";

const topics = [
  "Вопрос о\u00a0заказе",
  "Возврат или\u00a0обмен",
  "Сотрудничество",
  "Пресса",
  "Другое",
];

export function ContactForm() {
  const [sent, setSent] = useState(false);
  const {
    submitContactMessage,
    isPending,
    error: submitError,
    reset: resetSubmitState,
  } = useSubmitContactMessageMutation();
  const {
    formState: { errors },
    handleSubmit,
    register,
    reset,
    setValue,
    watch,
  } = useForm<ContactFormValues>({
    defaultValues: contactFormDefaultValues,
    resolver: zodResolver(contactFormSchema),
  });
  const formId = useId();
  const selectedTopic = watch("topic");

  const submitForm = handleSubmit(async (values) => {
    try {
      await submitContactMessage(values);
      reset();
      setSent(true);
    } catch {
      // The mutation error is rendered below the form controls.
    }
  });
  const handleSendAnother = () => {
    reset();
    resetSubmitState();
    setSent(false);
  };

  if (sent) {
    return (
      <Card className="shadow-sm">
        <CardContent className="space-y-5 py-8 md:py-10">
          <span className="flex size-12 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200/70">
            <CheckCircle2 className="size-6" />
          </span>
          <div className="space-y-2">
            <CardTitle className="text-2xl">Сообщение отправлено</CardTitle>
            <CardDescription className="max-w-md">
              Мы&nbsp;получили ваше сообщение и&nbsp;скоро ответим. Если дело срочное, напишите нам
              в&nbsp;Telegram.
            </CardDescription>
          </div>
          <Button type="button" variant="outline" onClick={handleSendAnother}>
            Отправить ещё одно
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm">
      <CardHeader className="border-b">
        <CardTitle className="text-xl">Сообщение команде ARTMATE</CardTitle>
        <CardDescription>
          Заполните поля, и&nbsp;мы&nbsp;ответим на&nbsp;указанный email.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submitForm} className="space-y-6">
          <input hidden type="hidden" aria-hidden="true" {...register("topic")} />

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium text-foreground">Тема обращения</legend>
            <div className="flex flex-wrap gap-2">
              {topics.map((topic) => {
                const selected = selectedTopic === topic;

                return (
                  <Button
                    key={topic}
                    type="button"
                    size="sm"
                    variant={selected ? "default" : "outline"}
                    disabled={isPending}
                    aria-pressed={selected}
                    onClick={() =>
                      setValue("topic", selected ? "" : topic, {
                        shouldDirty: true,
                        shouldTouch: true,
                      })
                    }
                    className={cn(
                      selected &&
                        "bg-rose-500 text-white hover:bg-rose-600 focus-visible:border-rose-300 focus-visible:ring-rose-400/30",
                    )}
                  >
                    {topic}
                  </Button>
                );
              })}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`${formId}-name`}>Имя</Label>
              <Input
                id={`${formId}-name`}
                type="text"
                required
                autoComplete="name"
                placeholder="Анна"
                aria-invalid={Boolean(errors.name)}
                {...register("name")}
              />
              <FieldError message={errors.name?.message} />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`${formId}-email`}>Email</Label>
              <Input
                id={`${formId}-email`}
                type="email"
                required
                autoComplete="email"
                placeholder="anna@example.com"
                aria-invalid={Boolean(errors.email)}
                {...register("email")}
              />
              <FieldError message={errors.email?.message} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${formId}-order`}>
              Номер заказа <span className="text-muted-foreground">(необязательно)</span>
            </Label>
            <Input
              id={`${formId}-order`}
              type="text"
              inputMode="text"
              placeholder="#12345"
              aria-invalid={Boolean(errors.order)}
              {...register("order")}
            />
            <FieldError message={errors.order?.message} />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${formId}-message`}>Сообщение</Label>
            <Textarea
              id={`${formId}-message`}
              required
              rows={5}
              placeholder="Чем можем помочь?"
              className="min-h-32 resize-none"
              aria-invalid={Boolean(errors.message)}
              {...register("message")}
            />
            <FieldError message={errors.message?.message} />
          </div>

          <Button
            type="submit"
            size="lg"
            disabled={isPending}
            className="h-11 bg-gradient-to-r from-rose-500 to-orange-400 text-white shadow-lg shadow-rose-500/20 hover:from-rose-600 hover:to-orange-500"
          >
            {isPending ? "Отправляем" : "Отправить"}
            <Send data-icon="inline-end" />
          </Button>
          <FormError message={submitError?.message} />
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

function FormError({ message }: { readonly message?: string }) {
  if (!message) {
    return null;
  }

  return (
    <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {message}
    </p>
  );
}
