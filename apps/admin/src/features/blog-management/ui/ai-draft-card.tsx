"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Send, Sparkles } from "lucide-react";
import { useForm } from "react-hook-form";

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui";

import {
  aiBlogDraftRunDefaultValues,
  aiBlogDraftRunFormSchema,
  getStartAiBlogDraftRunInput,
  type AiBlogDraftRunFormValues,
} from "../lib";
import { useStartAiBlogDraftRun } from "../model";
import {
  fieldClassName,
  LabeledField,
  textareaClassName,
} from "./form-controls";

const sourceTypeLabels = {
  internet_research: "Актуальные темы из интернета",
  mixed: "Интернет + контекст Artmate",
  product_news: "Новинки товаров",
} as const;

export function AiBlogDraftCard() {
  const { handleSubmit, register, reset } = useForm<AiBlogDraftRunFormValues>({
    defaultValues: aiBlogDraftRunDefaultValues,
    resolver: zodResolver(aiBlogDraftRunFormSchema),
  });
  const { isPending, mutate } = useStartAiBlogDraftRun();
  const submitForm = handleSubmit((values) => {
    mutate(getStartAiBlogDraftRunInput(values), {
      onSuccess: () => reset(aiBlogDraftRunDefaultValues),
    });
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="size-4 text-rose-500" aria-hidden="true" />
          AI draft для блога
        </CardTitle>
        <CardDescription>
          Темы уйдут в Telegram на согласование, финальный результат создаст
          draft поста.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-3" onSubmit={submitForm}>
          <div className="grid gap-3 lg:grid-cols-[minmax(12rem,0.7fr)_minmax(16rem,1.3fr)_auto]">
            <LabeledField label="Режим">
              <select className={fieldClassName} {...register("sourceType")}>
                {Object.entries(sourceTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </LabeledField>
            <LabeledField label="Фокус">
              <textarea
                className={textareaClassName}
                placeholder="Например: статьи для новичков или подборка к новинкам недели"
                {...register("prompt")}
              />
            </LabeledField>
            <div className="flex items-end">
              <Button className="w-full" disabled={isPending} type="submit">
                <Send data-icon="inline-start" aria-hidden="true" />
                Запустить
              </Button>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
