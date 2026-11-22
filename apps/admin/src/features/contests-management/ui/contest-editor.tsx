"use client";
import { useRouter } from "next/navigation";
import {
  Controller,
  useForm,
  useWatch,
  type UseFormReturn,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { contestAppearances } from "@repo/ui/contest-design";
import { useContest, type Contest } from "@/entities/contest";
import { routes } from "@/shared/constants";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Checkbox,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@/shared/ui";
import {
  contestFormSchema,
  defaultContestValues,
  toContestForm,
  toContestInput,
  type ContestFormValues,
} from "../lib/form-values";
import { useCreateContest } from "../model/use-create-contest";
import { useUpdateContest } from "../model/use-update-contest";
import { ContestPrizeFields } from "./prize-fields";
import { AppearancePreview } from "./appearance-preview";

export function ContestEditor({ contestId }: { contestId?: string }) {
  const { contest, isPending, isError, refetch } = useContest(contestId);
  if (contestId && isPending) return <p role="status">Загружаем конкурс…</p>;
  if (contestId && isError)
    return (
      <div className="space-y-3">
        <p>Не удалось загрузить конкурс</p>
        <Button variant="outline" onClick={() => void refetch()}>
          Попробовать снова
        </Button>
      </div>
    );
  return (
    <EditorForm
      key={contest ? `${contest.id}:${contest.version}` : "new"}
      contest={contest}
    />
  );
}
function EditorForm({ contest }: { contest?: Contest }) {
  const router = useRouter();
  const form = useForm<ContestFormValues>({
    resolver: zodResolver(contestFormSchema),
    defaultValues: contest ? toContestForm(contest) : defaultContestValues,
  });
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = form;
  const create = useCreateContest((saved) =>
    router.replace(routes.contest(saved.id)),
  );
  const update = useUpdateContest(contest?.id ?? "");
  const pending = create.isPending || update.isPending;
  const selectionMode = useWatch({ control, name: "selectionMode" });
  const locked =
    Boolean(contest?.publishedAt) ||
    Boolean(contest?.entriesCount) ||
    contest?.stage === "completed";
  return (
    <form
      noValidate
      onSubmit={handleSubmit((values) => {
        const input = toContestInput(values, contest);
        if (contest) update.mutate({ ...input, version: contest.version });
        else create.mutate(input);
      })}
    >
      <fieldset
        disabled={pending}
        className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,.65fr)]"
      >
        {locked && (
          <p className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground xl:col-span-2">
            Задание, условия, сроки, призы и способ выбора победителей менять
            нельзя.
          </p>
        )}
        <div className="min-w-0 space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>О конкурсе</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <TextField
                form={form}
                name="title"
                readOnly={locked}
                label="Название"
                maxLength={160}
              />
              <TextField
                form={form}
                name="slug"
                label="Адрес страницы"
                maxLength={120}
                readOnly={Boolean(contest?.publishedAt)}
              />
              {contest?.publishedAt && (
                <p className="-mt-3 text-xs text-muted-foreground">
                  Адрес нельзя изменить после публикации.
                </p>
              )}
              <TextField
                form={form}
                name="description"
                label="Короткое описание"
                multiline
                maxLength={600}
              />
              <TextField
                form={form}
                name="task"
                readOnly={locked}
                label="Задание"
                multiline
                rows={5}
                maxLength={4000}
              />
              <TextField
                form={form}
                name="rules"
                readOnly={locked}
                label="Условия участия"
                multiline
                rows={7}
                help="Каждый пункт — с новой строки."
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Призы</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <ContestPrizeFields
                form={form}
                locked={locked}
                contest={contest}
              />
            </CardContent>
          </Card>
        </div>
        <div className="min-w-0 space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Сроки</CardTitle>
              <p className="text-sm text-muted-foreground">
                По московскому времени
              </p>
            </CardHeader>
            <CardContent className="space-y-5">
              <Controller
                control={control}
                name="selectionMode"
                render={({ field }) => (
                  <div className="space-y-2">
                    <Label htmlFor="contest-selection-mode">
                      Способ выбора победителей
                    </Label>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={locked}
                    >
                      <SelectTrigger
                        id="contest-selection-mode"
                        ref={field.ref}
                        onBlur={field.onBlur}
                        className="w-full"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="AUTOMATIC">
                          Случайно, по расписанию
                        </SelectItem>
                        <SelectItem value="MANUAL">
                          Вручную в админке
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FieldError
                      name="selectionMode"
                      message={errors.selectionMode?.message}
                    />
                  </div>
                )}
              />
              {selectionMode === "MANUAL" && (
                <>
                  <TextField
                    form={form}
                    name="manualEvaluator"
                    label="Кто оценивает работы"
                    maxLength={300}
                    readOnly={locked}
                  />
                  <TextField
                    form={form}
                    name="manualCriteria"
                    label="Критерии и порядок оценки"
                    multiline
                    rows={5}
                    maxLength={4000}
                    readOnly={locked}
                  />
                  <TextField
                    form={form}
                    name="manualTieBreak"
                    label="При равенстве оценок"
                    multiline
                    maxLength={1000}
                    readOnly={locked}
                  />
                </>
              )}
              <TextField
                form={form}
                name="opensAt"
                readOnly={locked}
                label="Начало приёма"
                type="datetime-local"
              />
              <TextField
                form={form}
                name="closesAt"
                readOnly={locked}
                label="Конец приёма"
                type="datetime-local"
              />
              <TextField
                form={form}
                name="drawAt"
                readOnly={locked}
                label="Выбор победителей"
                type="datetime-local"
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Оформление</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Controller
                control={control}
                name="appearance"
                render={({ field }) => (
                  <div className="space-y-2">
                    <Label htmlFor="contest-appearance">Тема</Label>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger
                        id="contest-appearance"
                        ref={field.ref}
                        onBlur={field.onBlur}
                        className="w-full"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent position="popper">
                        {Object.entries(contestAppearances).map(
                          ([id, theme]) => (
                            <SelectItem key={id} value={id}>
                              {theme.label}
                            </SelectItem>
                          ),
                        )}
                      </SelectContent>
                    </Select>
                    <FieldError
                      name="appearance"
                      message={errors.appearance?.message}
                    />
                  </div>
                )}
              />
              <AppearancePreview control={control} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Документы конкурса</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>
                Условия формируются при сохранении. После публикации изменить их
                нельзя.
              </p>
              {contest?.legalHref && (
                <Button asChild variant="outline" className="w-full">
                  <a
                    href={`/contest-documents/${encodeURIComponent(contest.slug)}/${encodeURIComponent(contest.legalDocumentId!)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Посмотреть условия конкурса
                  </a>
                </Button>
              )}
              {contest?.legalErrors.map((error) => (
                <p key={error} className="text-muted-foreground">
                  {error}
                </p>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-5 pt-6">
              <Controller
                control={control}
                name="published"
                render={({ field }) => (
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="contest-published"
                      checked={field.value}
                      onCheckedChange={(checked) =>
                        field.onChange(checked === true)
                      }
                      ref={field.ref}
                    />
                    <Label htmlFor="contest-published">
                      Опубликовать на сайте
                    </Label>
                  </div>
                )}
              />
              <Button
                type="submit"
                disabled={pending}
                className="min-h-11 w-full"
              >
                {pending
                  ? "Сохраняем…"
                  : contest
                    ? "Сохранить изменения"
                    : "Создать конкурс"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </fieldset>
    </form>
  );
}
function TextField({
  form,
  name,
  label,
  multiline = false,
  type = "text",
  rows = 3,
  help,
  ...props
}: {
  form: UseFormReturn<ContestFormValues>;
  name:
    | "title"
    | "slug"
    | "description"
    | "task"
    | "manualCriteria"
    | "manualTieBreak"
    | "manualEvaluator"
    | "rules"
    | "prize"
    | "prizeDetail"
    | "opensAt"
    | "closesAt"
    | "drawAt";
  label: string;
  multiline?: boolean;
  type?: string;
  rows?: number;
  help?: string;
  maxLength?: number;
  readOnly?: boolean;
}) {
  const error = form.formState.errors[name]?.message;
  const attrs = {
    id: `contest-${name}`,
    "aria-invalid": Boolean(error),
    "aria-describedby":
      [
        help ? `contest-${name}-help` : null,
        error ? `contest-${name}-error` : null,
      ]
        .filter(Boolean)
        .join(" ") || undefined,
    ...form.register(name),
    ...props,
  };
  return (
    <div className="space-y-2">
      <Label htmlFor={attrs.id}>{label}</Label>
      {multiline ? (
        <Textarea {...attrs} rows={rows} />
      ) : (
        <Input {...attrs} type={type} />
      )}
      {help && (
        <p
          id={`contest-${name}-help`}
          className="text-xs text-muted-foreground"
        >
          {help}
        </p>
      )}
      <FieldError name={name} message={error} />
    </div>
  );
}
function FieldError({ name, message }: { name: string; message?: string }) {
  return message ? (
    <p
      id={`contest-${name}-error`}
      role="alert"
      className="text-sm text-destructive"
    >
      {message}
    </p>
  ) : null;
}
