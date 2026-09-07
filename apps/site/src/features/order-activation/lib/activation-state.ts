export type ActivationFailure = "invalid" | "temporary";

export type ActivationPreflight = "idle" | "pending" | "valid" | ActivationFailure;

export type ActivationViewState = "loading" | "form" | ActivationFailure;

export const activationPreflightStates = {
  idle: "idle",
  pending: "pending",
  valid: "valid",
  invalid: "invalid",
} as const;

export const activationViewStates = {
  form: "form",
  loading: "loading",
  invalid: "invalid",
  temporary: "temporary",
} as const;

export function isCurrentActivationToken(
  mutationToken: string | undefined,
  currentToken: string,
) {
  return Boolean(currentToken) && mutationToken === currentToken;
}

export function classifyActivationFailure(error: unknown): ActivationFailure {
  const status =
    typeof error === "object" && error !== null && "status" in error
      ? (error as { status?: unknown }).status
      : undefined;

  return status === 400 || status === 404 || status === 410 ? "invalid" : "temporary";
}

export function getActivationViewState({
  confirmFailure,
  hasToken,
  preflight,
}: {
  confirmFailure?: ActivationFailure;
  hasToken: boolean;
  preflight: ActivationPreflight;
}): ActivationViewState {
  if (!hasToken || confirmFailure === "invalid" || preflight === "invalid") {
    return "invalid";
  }

  if (preflight === "temporary") {
    return "temporary";
  }

  return preflight === "valid" ? "form" : "loading";
}
