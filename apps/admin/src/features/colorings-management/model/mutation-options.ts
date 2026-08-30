export type ColoringMutationOptions<TData = void> = {
  readonly onSuccess?: (data: TData) => Promise<void> | void;
};
