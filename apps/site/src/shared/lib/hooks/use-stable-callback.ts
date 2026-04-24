'use client';

import { useEffect, useRef } from 'react';

export function useStableCallback<T extends (..._args: never[]) => unknown>(callback: T): T {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  return ((...args: Parameters<T>) => callbackRef.current(...args)) as T;
}
