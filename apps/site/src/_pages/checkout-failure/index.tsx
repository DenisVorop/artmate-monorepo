import { CheckoutFailure } from "@/features/checkout";

type CheckoutFailurePageProps = {
  orderId?: string;
};

export function CheckoutFailurePage({ orderId }: CheckoutFailurePageProps) {
  return (
    <main className="bg-background">
      <CheckoutFailure orderId={orderId} />
    </main>
  );
}
