"use client";

import { useRef, type ChangeEvent, type FocusEvent } from "react";
import type { UseFormRegisterReturn } from "react-hook-form";

import { PhoneMask } from "./phone-mask";

export function usePhoneMask(onChange: UseFormRegisterReturn["onChange"]) {
  const previous = useRef("");
  return {
    onFocus: (event: FocusEvent<HTMLInputElement>) => {
      previous.current = event.currentTarget.value;
    },
    onChange: (event: ChangeEvent<HTMLInputElement>) => {
      const input = event.currentTarget;
      const masked = PhoneMask.edit(
        input.value,
        input.selectionStart ?? input.value.length,
        previous.current,
        (event.nativeEvent as InputEvent).inputType,
      );
      input.value = masked.value;
      previous.current = masked.value;
      void onChange(event);
      input.setSelectionRange(masked.caret, masked.caret);
    },
  };
}
