import type { PromoPreview } from "@/entities/promocode";

type PromoPricingStateInput = {
  isError: boolean;
  isHydrating: boolean;
  isPaused: boolean;
  isPending: boolean;
  preview?: PromoPreview;
  selectedCode?: string;
};

export function getPromoPricingState({
  isError,
  isHydrating,
  isPaused,
  isPending,
  preview,
  selectedCode,
}: PromoPricingStateInput) {
  if (isHydrating || isPending || isPaused) {
    return { code: undefined, isReady: false, preview: undefined };
  }

  if (!selectedCode || isError) {
    return { code: undefined, isReady: true, preview: undefined };
  }

  if (preview?.code === selectedCode) {
    return { code: selectedCode, isReady: true, preview };
  }

  return { code: undefined, isReady: false, preview: undefined };
}
