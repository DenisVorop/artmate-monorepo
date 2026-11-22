import Image from "next/image";
import { useForm, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { AuthUser } from "@/entities/session";
import { routes } from "@/shared/constants";
import {
  Button,
  Input,
  Label,
  PageHero,
  PersonalDataConsentCheckbox,
  Separator,
  Textarea,
} from "@/shared/ui";
import { Link } from "@/shared/ui/link";
import { usePrizeDraft } from "../lib/draft-state";
import {
  formatPrizePhone,
  prizeCheckoutSchema,
  toPrizeOrderInput,
  type PrizeCheckoutValues,
} from "../lib/forms";
import { albumQuantity, prizeTitle } from "../lib/format";
import type { AlbumPrize, PrizePickupSelection } from "../lib/types";
import { useCreatePrizeOrder } from "../model/use-create-prize-order";
import { PrizeDelivery } from "./pickup-picker";

export function PrizeCheckout({ user, prize }: { user: AuthUser; prize: AlbumPrize }) {
  const state = usePrizeDraft(user.id, prize);
  if (!state.isReady) return <p role="status">Загружаем выбранные альбомы…</p>;
  if (state.draft.albumIds.length !== prize.quantity)
    return (
      <div className="space-y-7">
        <CheckoutHeading prize={prize} />
        <div className="space-y-4 rounded-2xl border p-6">
          <p>Сначала выберите {albumQuantity(prize.quantity)}.</p>
          <Button asChild>
            <Link href={routes.prizeAlbums(prize.id)}>Выбрать альбомы</Link>
          </Button>
        </div>
      </div>
    );
  return <CheckoutForm user={user} prize={prize} draftState={state} />;
}
function CheckoutHeading({ prize }: { prize: AlbumPrize }) {
  return (
    <PageHero
      title="Получение приза"
      description={prize.contestTitle}
      breadcrumbs={[
        { label: "Личный кабинет", href: routes.account },
        { label: "Мои призы", href: routes.accountPrizes },
        { label: "Выбор альбомов", href: routes.prizeAlbums(prize.id) },
        { label: "Получение приза" },
      ]}
    />
  );
}
function CheckoutForm({
  user,
  prize,
  draftState,
}: {
  user: AuthUser;
  prize: AlbumPrize;
  draftState: ReturnType<typeof usePrizeDraft>;
}) {
  const { draft, saveDraft } = draftState;
  const form = useForm<PrizeCheckoutValues>({
    resolver: zodResolver(prizeCheckoutSchema),
    mode: "onBlur",
    defaultValues: {
      name: draft.contacts?.name ?? user.name ?? "",
      email: draft.contacts?.email ?? user.email ?? "",
      phone: draft.contacts?.phone ?? formatPrizePhone(user.phone ?? ""),
      comment: draft.contacts?.comment ?? "",
      pickupPointId: draft.pickup?.point.id ?? "",
      acceptedLegal: false,
      acceptedPersonalDataConsent: false,
    },
  });
  const albums = draft.albumIds.flatMap((id) => {
    const album = prize.albums.find((item) => item.id === id);
    return album ? [album] : [];
  });
  const hasUnavailableAlbums =
    albums.length !== prize.quantity || albums.some((album) => !album.available);
  const { mutate: createOrder, isPending: isSubmitting } = useCreatePrizeOrder(
    user.id,
    prize,
    (message) => form.setError("root", { message }),
  );
  function saveContacts(pickup: PrizePickupSelection | undefined = draft.pickup) {
    const { name, email, phone, comment } = form.getValues();
    saveDraft({ ...draft, contacts: { name, email, phone, comment }, pickup });
  }
  return (
    <div className="space-y-8">
      <CheckoutHeading prize={prize} />
      <form
        noValidate
        onBlur={() => saveContacts()}
        aria-busy={isSubmitting}
        onSubmit={form.handleSubmit((values) => {
          if (hasUnavailableAlbums) return;
          form.clearErrors("root");
          saveContacts();
          createOrder(toPrizeOrderInput(draft.albumIds, values));
        })}
        className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]"
      >
        <fieldset disabled={isSubmitting} className="contents">
          <div className="min-w-0 overflow-hidden rounded-2xl border bg-background px-5 sm:px-7">
            <section className="space-y-5 py-6 sm:py-7" aria-labelledby="prize-recipient-heading">
              <h2
                id="prize-recipient-heading"
                className="flex items-baseline gap-3 text-xl font-semibold"
              >
                <span aria-hidden className="font-mono text-sm text-rose-500">
                  01
                </span>
                Получатель
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <ContactField form={form} name="name" label="Имя и фамилия" autoComplete="name" />
                <ContactField
                  form={form}
                  name="email"
                  label="Электронная почта"
                  type="email"
                  autoComplete="email"
                  readOnly={Boolean(user.email)}
                />
                <div className="sm:col-span-2">
                  <ContactField
                    form={form}
                    name="phone"
                    label="Телефон"
                    type="tel"
                    autoComplete="tel"
                    placeholder="+7 (999) 999-99-99"
                  />
                  {draft.pickup && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Для Ozon укажите телефон из вашего профиля Ozon.
                    </p>
                  )}
                </div>
              </div>
            </section>
            <Separator />
            <section className="space-y-5 py-6 sm:py-7" aria-labelledby="prize-delivery-heading">
              <h2
                id="prize-delivery-heading"
                className="flex items-baseline gap-3 text-xl font-semibold"
              >
                <span aria-hidden className="font-mono text-sm text-rose-500">
                  02
                </span>
                Доставка
              </h2>
              <PrizeDelivery
                selected={draft.pickup}
                onSelect={(selection) => {
                  form.setValue("pickupPointId", selection.point.id, { shouldValidate: true });
                  saveContacts(selection);
                }}
              />
              <FieldError message={form.formState.errors.pickupPointId?.message} />
            </section>
            <Separator />
            <section className="space-y-5 py-6 sm:py-7" aria-labelledby="prize-items-heading">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h2
                  id="prize-items-heading"
                  className="flex items-baseline gap-3 text-xl font-semibold"
                >
                  <span aria-hidden className="font-mono text-sm text-rose-500">
                    03
                  </span>
                  Ваши альбомы
                </h2>
                <Link
                  href={routes.prizeAlbums(prize.id)}
                  className="py-2 text-sm underline underline-offset-4"
                >
                  Изменить выбор
                </Link>
              </div>
              {hasUnavailableAlbums && (
                <p role="alert" className="text-sm text-destructive">
                  Один из альбомов сейчас недоступен. Измените выбор.
                </p>
              )}
              <ul className="divide-y">
                {albums.map((album) => (
                  <li
                    key={album.id}
                    className="flex min-w-0 items-center gap-4 py-4 first:pt-0 last:pb-0"
                  >
                    <Image
                      src={album.image}
                      alt={album.title}
                      width={72}
                      height={96}
                      className="h-24 w-18 shrink-0 rounded-lg bg-stone-50 object-contain"
                    />
                    <div className="min-w-0 flex-1 space-y-1">
                      <h3 className="font-semibold">{album.title}</h3>
                      <p className="text-sm text-muted-foreground">1 шт.</p>
                    </div>
                    <strong className="shrink-0">0 ₽</strong>
                  </li>
                ))}
              </ul>
              <details>
                <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">
                  Комментарий к заказу
                </summary>
                <Label htmlFor="prize-comment" className="sr-only">
                  Комментарий к заказу
                </Label>
                <Textarea
                  id="prize-comment"
                  rows={3}
                  maxLength={1000}
                  {...form.register("comment")}
                />
                <FieldError message={form.formState.errors.comment?.message} />
              </details>
            </section>
          </div>
          <aside
            aria-labelledby="prize-summary-heading"
            className="space-y-5 rounded-2xl border border-rose-100 bg-gradient-to-br from-rose-50/70 via-white to-orange-50/60 p-5 sm:p-6 lg:sticky lg:top-[calc(var(--site-header-nav-height)+var(--site-header-banner-height)+1rem)] lg:max-h-[calc(100dvh-var(--site-header-nav-height)-var(--site-header-banner-height)-var(--site-cookie-consent-height)-2rem)] lg:overflow-y-auto"
          >
            <div className="space-y-2">
              <h2 id="prize-summary-heading" className="font-heading text-xl font-bold">
                Сумма заказа
              </h2>
              <p className="text-sm text-muted-foreground">{prizeTitle(prize.quantity)}</p>
            </div>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-3">
                <dt>{albumQuantity(prize.quantity)}</dt>
                <dd className="font-semibold">0 ₽</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Доставка</dt>
                <dd className="font-semibold">0 ₽</dd>
              </div>
              <div className="flex justify-between gap-3 border-t border-rose-100 pt-5 text-xl font-bold">
                <dt>Итого</dt>
                <dd>0 ₽</dd>
              </div>
            </dl>
            <p className="text-sm leading-6 text-stone-600">
              Альбомы и доставку оплачивает Artmate.
            </p>
            <div className="space-y-4 text-xs leading-5">
              <div className="flex items-start gap-3">
                <input
                  id="prize-offer"
                  type="checkbox"
                  className="mt-0.5 size-4 shrink-0 accent-rose-500"
                  aria-invalid={Boolean(form.formState.errors.acceptedLegal)}
                  {...form.register("acceptedLegal")}
                />
                <span>
                  <label htmlFor="prize-offer">Я принимаю условия </label>
                  <Link
                    href={routes.legal.publicOffer}
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    публичной оферты
                  </Link>
                  .
                </span>
              </div>
              <FieldError message={form.formState.errors.acceptedLegal?.message} />
              <PersonalDataConsentCheckbox
                id="prize-data-consent"
                className="border-0 bg-transparent p-0 text-xs [&>label]:min-h-6 [&>label]:min-w-6 [&>label]:items-start [&>label]:pt-0.5 [&>span]:py-0"
                hasError={Boolean(form.formState.errors.acceptedPersonalDataConsent)}
                {...form.register("acceptedPersonalDataConsent")}
              />
              <FieldError message={form.formState.errors.acceptedPersonalDataConsent?.message} />
            </div>
            <Button
              type="submit"
              disabled={isSubmitting || hasUnavailableAlbums}
              className="min-h-12 w-full rounded-xl"
            >
              {isSubmitting ? "Оформляем…" : "Оформить заказ"}
            </Button>
            <FieldError message={form.formState.errors.root?.message} />
          </aside>
        </fieldset>
      </form>
    </div>
  );
}
function ContactField({
  form,
  name,
  label,
  type = "text",
  autoComplete,
  placeholder,
  readOnly,
}: {
  form: UseFormReturn<PrizeCheckoutValues>;
  name: "name" | "email" | "phone";
  label: string;
  type?: string;
  autoComplete: string;
  placeholder?: string;
  readOnly?: boolean;
}) {
  const field = form.register(name),
    error = form.formState.errors[name]?.message;
  return (
    <div className="space-y-2">
      <Label htmlFor={`prize-${name}`}>{label}</Label>
      <Input
        id={`prize-${name}`}
        type={type}
        autoComplete={autoComplete}
        placeholder={placeholder}
        readOnly={readOnly}
        maxLength={name === "phone" ? 18 : name === "email" ? 254 : 120}
        aria-required
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `prize-${name}-error` : undefined}
        className={`min-h-11 ${readOnly ? "bg-muted/50 text-muted-foreground" : ""}`}
        {...field}
        onChange={(event) => {
          if (name === "phone") event.target.value = formatPrizePhone(event.target.value);
          void field.onChange(event);
        }}
      />
      {error && (
        <p id={`prize-${name}-error`} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
function FieldError({ message }: { message?: string }) {
  return message ? (
    <p role="alert" className="text-sm text-destructive">
      {message}
    </p>
  ) : null;
}
