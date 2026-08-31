type QueryFreshnessInput<T> = {
  data: T | undefined;
  fetchStatus?: "fetching" | "paused" | "idle";
  isError: boolean;
  isFetching: boolean;
  isPaused?: boolean;
};

export function getFreshQueryData<T>({
  data,
  fetchStatus,
  isError,
  isFetching,
  isPaused,
}: QueryFreshnessInput<T>) {
  return isError || isFetching || isPaused || fetchStatus === "paused" ? undefined : data;
}
