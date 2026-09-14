"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { SlidersHorizontal } from "lucide-react";
import type { Page, Project } from "@/entities/project";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/shared/ui/dialog";
import {
  pageSchema,
  projectSchema,
  type ProjectValues,
  type PageValues,
} from "../lib/schema";
import { pageValues, projectValues } from "../lib/settings-values";
import { useUpdateProject } from "../model/use-update-project";
import { useUpdatePage } from "../model/use-update-page";
const fields = [
  {
    key: "colors",
    label: "Количество цветов",
    unit: "",
    min: 2,
    max: 35,
    step: "1",
    flag: "own_colors",
  },
  {
    key: "min_area_mm2",
    label: "Минимальная область",
    unit: "мм²",
    min: 0.001,
    max: 10000,
    step: "any",
    flag: "own_area",
  },
  {
    key: "font_size_px",
    label: "Размер символов",
    unit: "px",
    min: 4,
    max: 32,
    step: ".01",
    flag: "own_font",
  },
] as const;
export function ProjectSettings({ project }: { project: Project }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <SlidersHorizontal />
          Настройки проекта
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Общие параметры</DialogTitle>
          <DialogDescription>
            Применяются к страницам без индивидуальных настроек. Расчёт
            запускается отдельно.
          </DialogDescription>
        </DialogHeader>
        <ProjectSettingsForm
          key={`${project.id}-${open}`}
          project={project}
          onSaved={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
function ProjectSettingsForm({
  project,
  onSaved,
}: {
  project: Project;
  onSaved: () => void;
}) {
  const action = useUpdateProject(project.id, project.version);
  const form = useForm<ProjectValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: projectValues(project),
  });
  return (
    <form
      className="book-settings"
      onSubmit={form.handleSubmit((values) =>
        action.mutate(values, { onSuccess: onSaved }),
      )}
    >
      <Label htmlFor="book-name">Название</Label>
      <Input id="book-name" {...form.register("name")} />
      {fields.map((field) => (
        <div className="parameter" key={field.key}>
          <Label htmlFor={`book-${field.key}`}>
            {field.label} {field.unit}
          </Label>
          <Input
            id={`book-${field.key}`}
            type="number"
            min={field.min}
            max={field.max}
            step={field.step}
            {...form.register(`settings.${field.key}`, { valueAsNumber: true })}
          />
          <small className="error">
            {form.formState.errors.settings?.[field.key]?.message}
          </small>
        </div>
      ))}
      <Label htmlFor="first-page">Номер первой страницы</Label>
      <Input
        id="first-page"
        type="number"
        min={1}
        max={999999}
        {...form.register("start_page", { valueAsNumber: true })}
      />
      <small>
        Цвета включают белые оттенки. Белые области не нумеруются. Площадь
        измеряется в мм², символы Arial — в CSS px.
      </small>
      <p className="error" role="alert">
        {action.error?.message ||
          form.formState.errors.name?.message ||
          form.formState.errors.start_page?.message}
      </p>
      <Button disabled={action.isPending}>Сохранить параметры</Button>
    </form>
  );
}
export function PageSettings({ page }: { page: Page }) {
  const action = useUpdatePage(page.id);
  const form = useForm<PageValues>({
    resolver: zodResolver(pageSchema),
    defaultValues: pageValues(page),
  });
  return (
    <form
      className="settings-form"
      onSubmit={form.handleSubmit((values) =>
        action.mutate(values, { onSuccess: () => form.reset(values) }),
      )}
    >
      <h2>Параметры страницы</h2>
      <Label htmlFor="page-name">Название изображения</Label>
      <Input id="page-name" {...form.register("name")} />
      {fields.map((field) => (
        <div className="parameter" key={field.key}>
          <div className="parameter-heading">
            <Label htmlFor={`page-${field.key}`}>
              {field.label} {field.unit}
            </Label>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              aria-pressed={form.watch(field.flag)}
              onClick={() =>
                form.setValue(field.flag, !form.getValues(field.flag), {
                  shouldDirty: true,
                })
              }
            >
              {form.watch(field.flag) ? "Свои" : "Из проекта"}
            </Button>
          </div>
          <Input
            id={`page-${field.key}`}
            type="number"
            min={field.min}
            max={field.max}
            step={field.step}
            disabled={!form.watch(field.flag)}
            {...form.register(`settings.${field.key}`, { valueAsNumber: true })}
          />
          <small className="error">
            {form.formState.errors.settings?.[field.key]?.message}
          </small>
        </div>
      ))}
      <div className="print-spec">
        <span>Печатный лист</span>
        <strong>612,28 × 858,9 px</strong>
        <small>Страница {page.number} · номер зависит от порядка</small>
      </div>
      <p className="error" role="alert">
        {action.error?.message || form.formState.errors.name?.message}
      </p>
      <Button
        variant="outline"
        className="w-full"
        disabled={action.isPending || !form.formState.isDirty}
      >
        Сохранить настройки страницы
      </Button>
      <p className="settings-footnote">
        Настройки сохраняются отдельно от запуска обработки.
      </p>
    </form>
  );
}
