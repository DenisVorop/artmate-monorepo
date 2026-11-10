import { CheckoutFailure, GuestCheckoutFailure, PaymentReturnAnalytics } from "@/features/checkout";

type CheckoutFailurePageProps = {
  hasOwnerOrder: boolean;
  isFailureRoute?: boolean;
  orderId?: string;
};

export function CheckoutFailurePage({
  hasOwnerOrder,
  isFailureRoute,
  orderId,
}: CheckoutFailurePageProps) {
  return (
    <main className="bg-background">
      {isFailureRoute && <PaymentReturnAnalytics isFailure orderId={orderId} />}
      {hasOwnerOrder && orderId ? (
        <CheckoutFailure orderId={orderId} />
      ) : (
        <GuestCheckoutFailure orderId={orderId} />
      )}
    </main>
  );
}
