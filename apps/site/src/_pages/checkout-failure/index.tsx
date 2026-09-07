import { CheckoutFailure, GuestCheckoutFailure } from "@/features/checkout";

type CheckoutFailurePageProps = {
  hasOwnerOrder: boolean;
  orderId?: string;
};

export function CheckoutFailurePage({ hasOwnerOrder, orderId }: CheckoutFailurePageProps) {
  return (
    <main className="bg-background">
      {hasOwnerOrder && orderId ? (
        <CheckoutFailure orderId={orderId} />
      ) : (
        <GuestCheckoutFailure orderId={orderId} />
      )}
    </main>
  );
}
