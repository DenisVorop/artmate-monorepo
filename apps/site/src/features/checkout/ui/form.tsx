"use client";

import { ArrowLeft, LoaderCircle, Send, UserRound } from "lucide-react";
import { useFormContext } from "react-hook-form";

import { routes } from "@/shared/constants";
import { cn } from "@/shared/lib";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  CtaGradientButton,
  Input,
  Label,
  Separator,
  Textarea,
} from "@/shared/ui";
import { Link } from "@/shared/ui/link";

import {
  checkoutOrderFormId,
  checkoutPhonePlaceholder,
  formatCheckoutPhone,
  type CheckoutFormValues,
  useCheckout,
} from "../lib";

export function CheckoutContactsStep() {
  const { continueFromContacts, goBack } = useCheckout();

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void continueFromContacts();
      }}
    >
      <Card>
        <CardHeader>
          <CardTitle>Контактные данные</CardTitle>
          <CardDescription>Оставьте имя, телефон и email для подтверждения заказа.</CardDescription>
        </CardHeader>
        <CardContent>
          <CheckoutContactFields />
        </CardContent>
        <CardFooter className="justify-between gap-3">
          <Button type="button" variant="outline" onClick={goBack}>
            <ArrowLeft data-icon="inline-start" />
            Назад
          </Button>
          <Button type="submit" className="bg-rose-500 text-white hover:bg-rose-600">
            <UserRound data-icon="inline-start" />
            Продолжить
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}

export function CheckoutConfirmationStep() {
  const {
    checkoutCalculation,
    goBack,
    isSubmitting,
    requiresAuth,
    selectedDelivery,
    submitLabel,
    submitOrder,
  } = useCheckout();
  const {
    watch,
    formState: { errors },
  } = useFormContext<CheckoutFormValues>();
  const [name, phone, email, comment] = watch(["name", "phone", "email", "comment"]);
  const pickupPoint = checkoutCalculation.calculation?.delivery.pickupPoint;
  const isSubmitDisabled = isSubmitting || checkoutCalculation.isPending || !selectedDelivery;

  return (
    <form id={checkoutOrderFormId} onSubmit={submitOrder}>
      <Card>
        <CardHeader>
          <CardTitle>Подтверждение</CardTitle>
          <CardDescription>Проверьте контакты и условия перед созданием заказа.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <ReviewBlock label="Имя" value={name} />
            <ReviewBlock label="Телефон" value={phone} />
            <ReviewBlock label="Email" value={email} className="sm:col-span-2" />
            {comment.trim() ? (
              <ReviewBlock label="Комментарий" value={comment} className="sm:col-span-2" />
            ) : null}
          </div>

          <Separator />

          <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 text-sm">
            <p className="font-medium">СДЭК, пункт выдачи</p>
            {pickupPoint ? (
              <div className="mt-1 space-y-0.5 text-muted-foreground">
                <p>{pickupPoint.address}</p>
                <p className="text-xs">{pickupPoint.workHours}</p>
              </div>
            ) : (
              <p className="mt-1 text-muted-foreground">Доставка выбрана, стоимость обновляется.</p>
            )}
          </div>

          <CheckoutLegalField />
          <FieldError message={errors.acceptedLegal?.message} />

          {requiresAuth ? (
            <p className="rounded-lg border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
              После нажатия откроется вход по email, затем заказ отправится автоматически.
            </p>
          ) : null}
        </CardContent>
        <CardFooter className="justify-between gap-3">
          <Button type="button" variant="outline" onClick={goBack}>
            <ArrowLeft data-icon="inline-start" />
            Назад
          </Button>
          <CtaGradientButton
            type="submit"
            size="lg"
            disabled={isSubmitDisabled}
            className="min-w-44"
          >
            {isSubmitting ? (
              <LoaderCircle data-icon="inline-start" className="animate-spin" />
            ) : (
              <Send data-icon="inline-start" />
            )}
            {submitLabel}
          </CtaGradientButton>
        </CardFooter>
      </Card>
    </form>
  );
}

function CheckoutContactFields() {
  const { isEmailLocked } = useCheckout();
  const {
    register,
    formState: { errors },
  } = useFormContext<CheckoutFormValues>();
  const phoneField = register("phone");

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="checkout-name">Имя</Label>
        <Input
          id="checkout-name"
          type="text"
          autoComplete="name"
          placeholder="Анна Иванова"
          aria-invalid={Boolean(errors.name)}
          {...register("name")}
        />
        <FieldError message={errors.name?.message} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="checkout-phone">Телефон</Label>
        <Input
          id="checkout-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder={checkoutPhonePlaceholder}
          maxLength={checkoutPhonePlaceholder.length}
          aria-invalid={Boolean(errors.phone)}
          {...phoneField}
          onChange={(event) => {
            event.target.value = formatCheckoutPhone(event.target.value);
            void phoneField.onChange(event);
          }}
        />
        <FieldError message={errors.phone?.message} />
      </div>

      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="checkout-email">Email</Label>
        <Input
          id="checkout-email"
          type="email"
          autoComplete="email"
          placeholder="anna@example.com"
          readOnly={isEmailLocked}
          aria-readonly={isEmailLocked}
          aria-invalid={Boolean(errors.email)}
          className={isEmailLocked ? "cursor-not-allowed bg-input/50 opacity-75" : undefined}
          {...register("email")}
        />
        {isEmailLocked ? (
          <p className="text-xs text-muted-foreground">
            Email взяли из профиля, на него придет подтверждение входа и заказа.
          </p>
        ) : null}
        <FieldError message={errors.email?.message} />
      </div>

      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="checkout-comment">
          Комментарий <span className="text-muted-foreground">(необязательно)</span>
        </Label>
        <Textarea
          id="checkout-comment"
          rows={4}
          placeholder="Например, пожелания по упаковке"
          className="min-h-24 resize-none"
          {...register("comment")}
        />
        <FieldError message={errors.comment?.message} />
      </div>
    </div>
  );
}

function CheckoutLegalField() {
  const {
    register,
    formState: { errors },
  } = useFormContext<CheckoutFormValues>();

  return (
    <label
      className={cn(
        "flex items-start gap-3 rounded-lg border bg-muted/30 p-3 text-sm",
        errors.acceptedLegal && "border-destructive/50 bg-destructive/5",
      )}
    >
      <input
        type="checkbox"
        className="mt-0.5 size-4 rounded border-border accent-rose-500"
        aria-invalid={Boolean(errors.acceptedLegal)}
        {...register("acceptedLegal")}
      />
      <span className="text-muted-foreground">
        Я принимаю{" "}
        <Link href={routes.legal.publicOffer} className="text-foreground underline">
          оферту
        </Link>{" "}
        и{" "}
        <Link href={routes.legal.personalDataConsent} className="text-foreground underline">
          соглашаюсь на обработку персональных данных
        </Link>
        .
      </span>
    </label>
  );
}

function ReviewBlock({
  className,
  label,
  value,
}: {
  className?: string;
  label: string;
  value: string;
}) {
  return (
    <div className={cn("rounded-lg border bg-muted/30 px-3 py-2 text-sm", className)}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-medium break-words">{value}</p>
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="text-sm text-destructive">{message}</p>;
}
