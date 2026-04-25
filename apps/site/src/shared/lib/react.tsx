"use client";

import type { ReactNode, Context } from "react";
import { Children, createElement, isValidElement, createContext, useContext } from "react";

export function ComposeProviders({ children }: { children: ReactNode }) {
  const array = Children.toArray(children);
  const last = array.pop();
  return (
    <>
      {array.reduceRight(
        (child, element) =>
          isValidElement(element) ? createElement(element.type, element.props, child) : child,
        last,
      )}
    </>
  );
}

export function useStrictContext<T>(context: Context<T | null>) {
  const value = useContext(context);
  if (value === null) throw new Error("Strict context not passed");
  return value as T;
}

export function createStrictContext<T>() {
  return createContext<T | null>(null);
}
