"use client";

import { Button } from "@/shared/ui";
import ChevronRight from "@/shared/ui/payment-logos/assets/chevron-right.svg";
import DolyameSymbol from "@/shared/ui/payment-logos/assets/dolyame-symbol.svg";

import { DolyameInfo } from "./info-dialog";
import styles from "./styles.module.css";

export function DolyameProductBadge() {
  return (
    <DolyameInfo>
      <Button
        type="button"
        variant="ghost"
        aria-label="Подробнее об оплате Долями"
        className={styles.productBadge}
      >
        <DolyameSymbol aria-hidden="true" className="size-6" />
        <span className={styles.productText}>Купите сейчас — платите потом</span>
        <ChevronRight aria-hidden="true" className="size-6" />
      </Button>
    </DolyameInfo>
  );
}
