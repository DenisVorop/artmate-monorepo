export type MutationSuccessCallback = () => Promise<unknown> | unknown;

export type MutationOptions = {
  readonly onSuccess?: MutationSuccessCallback;
};
