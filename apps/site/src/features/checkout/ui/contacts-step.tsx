"use client";

import { ArrowLeft, UserRound } from "lucide-react";

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/shared/ui";

import { useCheckout } from "../lib";

import { ContactFields } from "./contact-fields";

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
          <ContactFields />
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
