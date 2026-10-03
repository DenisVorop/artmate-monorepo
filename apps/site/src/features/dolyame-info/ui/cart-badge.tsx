"use client";

import { Button } from "@/shared/ui";
import ChevronRight from "@/shared/ui/payment-logos/assets/chevron-right.svg";
import DolyameSymbol from "@/shared/ui/payment-logos/assets/dolyame-symbol.svg";

import { DolyameInfo } from "./info-dialog";
import styles from "./styles.module.css";

export function DolyameCartBadge() {
  return (
    <DolyameInfo>
      <Button type="button" variant="ghost" className={styles.cartBadge}>
        <DolyameSymbol aria-hidden="true" className="size-[30px]" />
        <span className={styles.cartText}>
          <span className={styles.cartTitle}>Оплата Долями</span>
          <span className={styles.cartDescription}>Купите сейчас — платите потом</span>
        </span>
        <ChevronRight aria-hidden="true" className="size-6" />
      </Button>
    </DolyameInfo>
  );
}
