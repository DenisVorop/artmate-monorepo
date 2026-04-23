"use client";

import { CheckCircle2, Send } from "lucide-react";
import { useId, useState } from "react";
import type { FormEvent } from "react";

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
  cn,
} from "@/shared";

const topics = [
  "Вопрос о\u00a0заказе",
  "Возврат или\u00a0обмен",
  "Сотрудничество",
  "Пресса",
  "Другое",
];

export function ContactForm() {
  const [activeTopic, setActiveTopic] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const formId = useId();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSent(true);
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
          <Button type="button" variant="outline" onClick={() => setSent(false)}>
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
        <form onSubmit={handleSubmit} className="space-y-6">
          <input hidden type="hidden" name="topic" value={activeTopic ?? ""} aria-hidden="true" />

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium text-foreground">Тема обращения</legend>
            <div className="flex flex-wrap gap-2">
              {topics.map((topic) => {
                const selected = activeTopic === topic;

                return (
                  <Button
                    key={topic}
                    type="button"
                    size="sm"
                    variant={selected ? "default" : "outline"}
                    aria-pressed={selected}
                    onClick={() => setActiveTopic(selected ? null : topic)}
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
                name="name"
                type="text"
                required
                autoComplete="name"
                placeholder="Анна"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`${formId}-email`}>Email</Label>
              <Input
                id={`${formId}-email`}
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="anna@example.com"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${formId}-order`}>
              Номер заказа <span className="text-muted-foreground">(необязательно)</span>
            </Label>
            <Input
              id={`${formId}-order`}
              name="order"
              type="text"
              inputMode="text"
              placeholder="#12345"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${formId}-message`}>Сообщение</Label>
            <Textarea
              id={`${formId}-message`}
              name="message"
              required
              rows={5}
              placeholder="Чем можем помочь?"
              className="min-h-32 resize-none"
            />
          </div>

          <Button
            type="submit"
            size="lg"
            className="h-11 bg-gradient-to-r from-rose-500 to-orange-400 text-white shadow-lg shadow-rose-500/20 hover:from-rose-600 hover:to-orange-500"
          >
            Отправить
            <Send data-icon="inline-end" />
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
