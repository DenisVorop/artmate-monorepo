export type MutationOptions<TData> = {
  readonly onSuccess?: (data: TData) => Promise<unknown> | unknown;
};
