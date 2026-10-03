"use client";

import { useId, type ReactElement } from "react";
import { XIcon } from "lucide-react";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
  Button,
} from "@/shared/ui";
import { PaymentLogo } from "@/shared/ui/payment-logos";

import styles from "./styles.module.css";

const steps = [
  "При оформлении заказа выберите оплату через Т-Банк.",
  "На странице оплаты Т-Банка выберите Долями и ознакомьтесь с условиями.",
  "Подтвердите оплату. Заказ начнём готовить после её подтверждения.",
];

export function DolyameInfo({ children }: { children: ReactElement }) {
  const howToId = useId();

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent
        className={styles.dialog}
        overlayClassName={styles.overlay}
        showCloseButton={false}
      >
        <div className={styles.dialogBrand}>
          <PaymentLogo brand="dolyame" />
          <DialogClose asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Закрыть информацию о Долями"
              className={styles.close}
            >
              <XIcon aria-hidden="true" className="size-4" strokeWidth={1.5} />
            </Button>
          </DialogClose>
        </div>
        <div className={styles.intro}>
          <DialogTitle className={styles.title}>Разделите стоимость покупки</DialogTitle>
          <DialogDescription className={styles.description}>
            Забирайте товар сразу, а платите частями в течение комфортного срока.
          </DialogDescription>
        </div>
        <section className={styles.howTo} aria-labelledby={howToId}>
          <h3 id={howToId} className={styles.title}>
            Как оформить?
          </h3>
          <ol className={styles.steps}>
            {steps.map((step, index) => (
              <li key={step} className={styles.step}>
                <span className={styles.stepNumber} aria-hidden="true">
                  {index + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </section>
        <p className={styles.more}>
          Подробнее о сервисе — на{" "}
          <a href="https://dolyame.ru/" target="_blank" rel="noopener noreferrer">
            dolyame.ru
          </a>
        </p>
      </DialogContent>
    </Dialog>
  );
}
