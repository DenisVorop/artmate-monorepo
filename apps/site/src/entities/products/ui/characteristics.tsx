"use client";

import { useId } from "react";

import { useIsMobile } from "@/shared/lib/device";
import { SectionTitle } from "@/shared/ui/typography";
import type { ProductCharacteristic } from "../model";
import { CharacteristicsList } from "./characteristics-list";
import { DetailsDrawer } from "./details-drawer";

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
        <DetailsDrawer
          title="Характеристики"
          productTitle={productTitle}
          triggerLabel={`Все характеристики (${characteristics.length})`}
        >
          <CharacteristicsList characteristics={characteristics} />
        </DetailsDrawer>
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
