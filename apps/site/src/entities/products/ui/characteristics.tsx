"use client";

import { ChevronRight, X } from "lucide-react";
import { useId } from "react";

import { useIsMobile } from "@/shared/lib/device";
import {
  Button,
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/shared/ui";
import { SectionTitle } from "@/shared/ui/typography";
import type { ProductCharacteristic } from "../model";
import { CharacteristicsList } from "./characteristics-list";

const mobilePreviewLimit = 6;

type CharacteristicsProps = {
  characteristics: ProductCharacteristic[];
  productTitle: string;
  id: string;
};

function MobileCharacteristics({
  characteristics,
  productTitle,
}: Omit<CharacteristicsProps, "id">) {
  return (
    <>
      <CharacteristicsList characteristics={characteristics.slice(0, mobilePreviewLimit)} />
      {characteristics.length > mobilePreviewLimit && (
        // eslint-disable-next-line jsx-a11y/no-autofocus -- Move focus into the modal only after the user opens it, not on page load.
        <Drawer autoFocus>
          <DrawerTrigger asChild>
            <Button type="button" variant="outline" className="mt-4 min-h-11 w-full">
              Все характеристики ({characteristics.length})
              <ChevronRight aria-hidden="true" />
            </Button>
          </DrawerTrigger>
          <DrawerContent className="data-[vaul-drawer-direction=bottom]:max-h-[90dvh]">
            <DrawerHeader className="relative shrink-0 border-b pr-16 group-data-[vaul-drawer-direction=bottom]/drawer-content:text-left">
              <DrawerTitle>Характеристики</DrawerTitle>
              <DrawerDescription className="wrap-anywhere">{productTitle}</DrawerDescription>
              <DrawerClose asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 size-11"
                  aria-label="Закрыть характеристики"
                >
                  <X aria-hidden="true" />
                </Button>
              </DrawerClose>
            </DrawerHeader>
            <div className="min-h-0 overflow-y-auto overscroll-contain px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <CharacteristicsList characteristics={characteristics} />
            </div>
          </DrawerContent>
        </Drawer>
      )}
    </>
  );
}

export function Characteristics({ characteristics, productTitle, id }: CharacteristicsProps) {
  const isMobile = useIsMobile();
  const headingId = useId();

  if (characteristics.length === 0) return null;

  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className="scroll-mt-[calc(var(--site-header-banner-height)+var(--site-header-nav-height)+1rem)] space-y-4 py-4 md:space-y-5 md:py-6"
    >
      <SectionTitle id={headingId}>Характеристики</SectionTitle>
      {isMobile ? (
        <MobileCharacteristics characteristics={characteristics} productTitle={productTitle} />
      ) : (
        <CharacteristicsList characteristics={characteristics} columns={2} />
      )}
    </section>
  );
}
