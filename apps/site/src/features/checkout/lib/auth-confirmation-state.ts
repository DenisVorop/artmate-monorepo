export type CheckoutAuthConfirmationState =
  | "ready"
  | "auth-required"
  | "manual-confirmation-required";

export type CheckoutAuthConfirmationEvent =
  | "request-auth"
  | "auth-succeeded"
  | "manual-confirmation";

export function transitionCheckoutAuthConfirmation(
  _state: CheckoutAuthConfirmationState,
  event: CheckoutAuthConfirmationEvent,
): CheckoutAuthConfirmationState {
  if (event === "request-auth") {
    return "auth-required";
  }

  if (event === "auth-succeeded") {
    return "manual-confirmation-required";
  }

  return "ready";
}
