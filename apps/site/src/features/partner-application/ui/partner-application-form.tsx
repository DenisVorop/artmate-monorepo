"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowRight,
  BadgeCheck,
  ChartNoAxesCombined,
  CheckCircle2,
  Gift,
  Send,
  Sparkles,
} from "lucide-react";
import { cloneElement, useEffect, useId, useRef, useState, type ReactElement } from "react";
import { Controller, useForm, type Control } from "react-hook-form";

import {
  Button,
  Card,
  CardContent,
  CtaGradientButton,
  Input,
  Label,
  PersonalDataConsentCheckbox,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@/shared/ui";

import {
  partnerApplicationFormDefaultValues,
  partnerApplicationFormSchema,
  trackPartnerProgramEvent,
  type PartnerApplicationFormValues,
} from "../lib";
import { useSubmitPartnerApplication } from "../model";

const partnerTypeOptions = [
  { label: "Автор контента или блогер", value: "creator" },
  { label: "Художник или иллюстратор", value: "artist" },
  { label: "Преподаватель или арт-школа", value: "educator" },
  { label: "Студия или мастерская", value: "studio" },
  { label: "Магазин", value: "retailer" },
  { label: "Другой формат", value: "other" },
] as const;

const audienceSizeOptions = [
  { label: "До 1 000 / только начинаю", value: "up_to_1000" },
  { label: "От 1 000 до 10 000", value: "1000_10000" },
  { label: "От 10 000 до 50 000", value: "10000_50000" },
  { label: "Более 50 000", value: "50000_plus" },
] as const;

const contactOptions = [
  { label: "Telegram", value: "telegram" },
  { label: "Email", value: "email" },
] as const;

const applicationBenefits = [
  {
    description: "Изучим вашу площадку и предложим подходящий формат.",
    icon: BadgeCheck,
    title: "Не шаблонная рассылка",
  },
  {
    description: "Продажи и вознаграждение будут видны в личном кабинете.",
    icon: ChartNoAxesCombined,
    title: "Статистика по кодам",
  },
  {
    description: "После запуска вы сами выберете баланс выгоды.",
    icon: Gift,
    title: "Гибкий промокод",
  },
] as const;

export function PartnerApplicationForm() {
  const [sent, setSent] = useState(false);
  const startedRef = useRef(false);
  const formId = useId();
  const {
    error: submitError,
    isPending,
    reset: resetMutation,
    submitPartnerApplication,
  } = useSubmitPartnerApplication();
  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
    reset,
    watch,
  } = useForm<PartnerApplicationFormValues>({
    defaultValues: partnerApplicationFormDefaultValues,
    resolver: zodResolver(partnerApplicationFormSchema),
  });
  const preferredContact = watch("preferredContact");

  useEffect(() => {
    const ctaLinks = Array.from(
      document.querySelectorAll<HTMLAnchorElement>('a[href="#partner-application"]'),
    );
    const trackClick = () => trackPartnerProgramEvent("partner_cta_click");

    ctaLinks.forEach((link) => link.addEventListener("click", trackClick));

    return () => {
      ctaLinks.forEach((link) => link.removeEventListener("click", trackClick));
    };
  }, []);

  const submitForm = handleSubmit(async (values) => {
    try {
      await submitPartnerApplication(values);
      trackPartnerProgramEvent("partner_form_success");
      reset();
      setSent(true);
    } catch {
      trackPartnerProgramEvent("partner_form_error");
    }
  });

  const handleFormStart = () => {
    if (startedRef.current) {
      return;
    }

    startedRef.current = true;
    trackPartnerProgramEvent("partner_form_start");
  };

  const handleSendAnother = () => {
    startedRef.current = false;
    reset();
    resetMutation();
    setSent(false);
  };

  return (
    <section id="partner-application" className="scroll-mt-28 px-4 pb-20 sm:pb-24 lg:pb-32">
      <div className="relative container overflow-hidden rounded-[2rem] bg-neutral-950 text-white shadow-2xl shadow-rose-950/10 sm:rounded-[2.5rem]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:44px_44px] opacity-25"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -top-40 -left-24 size-96 rounded-full bg-rose-500/30 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-32 -bottom-44 size-[28rem] rounded-full bg-violet-500/25 blur-3xl"
        />

        <div className="relative grid gap-10 px-5 py-8 sm:px-8 sm:py-10 lg:grid-cols-[0.78fr_1.22fr] lg:gap-14 lg:px-12 lg:py-14 xl:px-16 xl:py-16">
          <div className="flex flex-col justify-between gap-10 lg:py-4">
            <div className="space-y-6">
              <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/8 px-3 py-1.5 text-xs font-semibold tracking-[0.16em] text-rose-100 uppercase backdrop-blur">
                <Sparkles className="size-3.5 text-orange-300" />
                Заявка в партнёрскую программу
              </span>
              <div className="space-y-4">
                <h2 className="max-w-xl font-heading text-3xl leading-tight font-bold text-balance sm:text-4xl lg:text-5xl">
                  Давайте создавать поводы для творчества вместе
                </h2>
                <p className="max-w-lg text-base leading-7 text-neutral-300 sm:text-lg">
                  Расскажите о себе и своей площадке. Мы изучим заявку и свяжемся удобным для вас
                  способом.
                </p>
              </div>
            </div>

            <div className="grid gap-3">
              {applicationBenefits.map(({ description, icon: Icon, title }) => (
                <div
                  key={title}
                  className="flex gap-3 rounded-2xl border border-white/10 bg-white/6 p-4 backdrop-blur-sm"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-rose-400/25 to-orange-300/15 text-orange-200 ring-1 ring-white/10">
                    <Icon className="size-4.5" />
                  </span>
                  <div className="space-y-0.5">
                    <p className="font-semibold text-white">{title}</p>
                    <p className="text-sm leading-5 text-neutral-400">{description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Card className="border-white/10 bg-white text-foreground shadow-2xl shadow-black/25">
            <CardContent className="p-5 sm:p-7 lg:p-8">
              {sent ? (
                <SuccessState onSendAnother={handleSendAnother} />
              ) : (
                <form
                  noValidate
                  className="space-y-5"
                  onFocusCapture={handleFormStart}
                  onSubmit={submitForm}
                >
                  <div className="space-y-1">
                    <h3 className="font-heading text-2xl font-bold">Расскажите о себе</h3>
                    <p className="text-sm leading-6 text-muted-foreground">
                      Поля помогут нам сразу подготовить предметное предложение.
                    </p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <TextField error={errors.name?.message} id={`${formId}-name`} label="Имя">
                      <Input
                        id={`${formId}-name`}
                        autoComplete="name"
                        className="h-11"
                        placeholder="Анна"
                        aria-invalid={Boolean(errors.name)}
                        aria-required="true"
                        {...register("name")}
                      />
                    </TextField>

                    <TextField error={errors.email?.message} id={`${formId}-email`} label="Email">
                      <Input
                        id={`${formId}-email`}
                        type="email"
                        autoComplete="email"
                        className="h-11"
                        placeholder="anna@example.com"
                        aria-invalid={Boolean(errors.email)}
                        aria-required="true"
                        {...register("email")}
                      />
                    </TextField>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <SelectField
                      control={control}
                      error={errors.partnerType?.message}
                      id={`${formId}-partner-type`}
                      label="Ваш формат"
                      name="partnerType"
                      options={partnerTypeOptions}
                    />
                    <SelectField
                      control={control}
                      error={errors.audienceSize?.message}
                      id={`${formId}-audience-size`}
                      label="Размер аудитории"
                      name="audienceSize"
                      options={audienceSizeOptions}
                    />
                  </div>

                  <TextField
                    error={errors.channelUrl?.message}
                    id={`${formId}-channel-url`}
                    label="Ссылка на основную площадку"
                  >
                    <Input
                      id={`${formId}-channel-url`}
                      type="url"
                      inputMode="url"
                      className="h-11"
                      placeholder="https://t.me/your_channel"
                      aria-invalid={Boolean(errors.channelUrl)}
                      aria-required="true"
                      {...register("channelUrl")}
                    />
                  </TextField>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <SelectField
                      control={control}
                      error={errors.preferredContact?.message}
                      id={`${formId}-preferred-contact`}
                      label="Как связаться"
                      name="preferredContact"
                      options={contactOptions}
                    />

                    {preferredContact === "telegram" ? (
                      <TextField
                        error={errors.contactHandle?.message}
                        id={`${formId}-contact-handle`}
                        label="Telegram"
                      >
                        <Input
                          id={`${formId}-contact-handle`}
                          autoComplete="off"
                          className="h-11"
                          placeholder="@username"
                          aria-invalid={Boolean(errors.contactHandle)}
                          aria-required="true"
                          {...register("contactHandle")}
                        />
                      </TextField>
                    ) : (
                      <div className="space-y-2">
                        <p className="flex items-center gap-2 text-sm leading-none font-medium">
                          Email для ответа
                        </p>
                        <div className="flex h-11 items-center rounded-lg border border-dashed bg-muted/35 px-3 text-sm text-muted-foreground">
                          Используем адрес, указанный выше
                        </div>
                      </div>
                    )}
                  </div>

                  <TextField
                    error={errors.comment?.message}
                    id={`${formId}-comment`}
                    label="Идея сотрудничества"
                    optional
                  >
                    <Textarea
                      id={`${formId}-comment`}
                      rows={4}
                      className="min-h-28 resize-none"
                      placeholder="Расскажите о контенте, аудитории или формате, который хотите попробовать"
                      aria-invalid={Boolean(errors.comment)}
                      {...register("comment")}
                    />
                  </TextField>

                  <div
                    className="absolute top-auto -left-[10000px] size-px overflow-hidden"
                    aria-hidden
                  >
                    <Label htmlFor={`${formId}-website`}>Website</Label>
                    <Input
                      id={`${formId}-website`}
                      tabIndex={-1}
                      autoComplete="off"
                      {...register("website")}
                    />
                  </div>

                  <div className="space-y-2">
                    <PersonalDataConsentCheckbox
                      id={`${formId}-personal-data-consent`}
                      aria-describedby={
                        errors.acceptedPersonalDataConsent
                          ? `${formId}-personal-data-consent-error`
                          : undefined
                      }
                      hasError={Boolean(errors.acceptedPersonalDataConsent)}
                      {...register("acceptedPersonalDataConsent")}
                    />
                    <FieldError
                      id={`${formId}-personal-data-consent-error`}
                      message={errors.acceptedPersonalDataConsent?.message}
                    />
                  </div>

                  <CtaGradientButton
                    type="submit"
                    size="lg"
                    disabled={isPending}
                    className="h-12 w-full text-base shadow-lg shadow-rose-500/20"
                  >
                    {isPending ? "Отправляем заявку" : "Отправить заявку"}
                    <Send className="size-4" />
                  </CtaGradientButton>
                  <FormError message={submitError?.message} />
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}

type SelectOption = {
  readonly label: string;
  readonly value: string;
};

type SelectFieldProps = {
  readonly control: Control<PartnerApplicationFormValues>;
  readonly error?: string;
  readonly id: string;
  readonly label: string;
  readonly name: "audienceSize" | "partnerType" | "preferredContact";
  readonly options: readonly SelectOption[];
};

function SelectField({ control, error, id, label, name, options }: SelectFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <Select value={field.value} onValueChange={field.onChange} disabled={field.disabled}>
            <SelectTrigger
              id={id}
              size="lg"
              className="w-full"
              aria-describedby={error ? `${id}-error` : undefined}
              aria-invalid={Boolean(error)}
              aria-required="true"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" align="start">
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}

type TextFieldProps = {
  readonly children: ReactElement<{ "aria-describedby"?: string }>;
  readonly error?: string;
  readonly id: string;
  readonly label: string;
  readonly optional?: boolean;
};

function TextField({ children, error, id, label, optional }: TextFieldProps) {
  const errorId = `${id}-error`;

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label}
        {optional ? <span className="font-normal text-muted-foreground">необязательно</span> : null}
      </Label>
      {cloneElement(children, error ? { "aria-describedby": errorId } : {})}
      <FieldError id={errorId} message={error} />
    </div>
  );
}

function FieldError({ id, message }: { readonly id: string; readonly message?: string }) {
  return message ? (
    <p id={id} role="alert" className="text-sm text-destructive">
      {message}
    </p>
  ) : null;
}

function FormError({ message }: { readonly message?: string }) {
  if (!message) {
    return null;
  }

  return (
    <p
      role="alert"
      className="rounded-xl border border-destructive/25 bg-destructive/8 px-4 py-3 text-sm text-destructive"
    >
      Не удалось отправить заявку. Попробуйте ещё раз или напишите нам через страницу контактов.
    </p>
  );
}

function SuccessState({ onSendAnother }: { readonly onSendAnother: () => void }) {
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  return (
    <div className="flex min-h-[34rem] flex-col items-center justify-center py-10 text-center">
      <div role="status" aria-live="polite" className="flex flex-col items-center">
        <span className="mb-6 flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 text-emerald-600 ring-1 ring-emerald-200/80">
          <CheckCircle2 className="size-8" />
        </span>
        <h3 ref={titleRef} tabIndex={-1} className="font-heading text-3xl font-bold outline-none">
          Заявка уже у команды
        </h3>
        <p className="mt-3 max-w-md leading-7 text-muted-foreground">
          Изучим вашу площадку и свяжемся выбранным способом, чтобы обсудить формат и условия.
        </p>
      </div>
      <Button
        type="button"
        variant="ghost"
        onClick={onSendAnother}
        className="mt-7 text-rose-600 hover:bg-rose-50 hover:text-rose-700 focus-visible:ring-rose-400/30"
      >
        Отправить ещё одну заявку
        <ArrowRight className="size-4" />
      </Button>
    </div>
  );
}
