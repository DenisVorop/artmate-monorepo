"use client";

import { useState } from "react";

export function usePasswordVisibility() {
  const [isVisible, setIsVisible] = useState(false);

  return { isVisible, toggle: () => setIsVisible((value) => !value) };
}
