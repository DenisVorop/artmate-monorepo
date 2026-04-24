type AllContext<TData extends object> = {
  $: {
    [K in keyof TData]: Promise<TData[K]>;
  };
};

// eslint-disable-next-line unused-imports/no-unused-vars
export type TaskFn<TCtxData extends object, TResult> = (this: AllContext<TCtxData>) => Promise<TResult>;
