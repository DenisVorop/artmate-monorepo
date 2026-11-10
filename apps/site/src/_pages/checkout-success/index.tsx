import { CheckoutSuccess, GuestCheckoutSuccess, PaymentReturnAnalytics } from "@/features/checkout";

type CheckoutSuccessPageProps = {
  isAuthenticated: boolean;
  orderId?: string;
};

export function CheckoutSuccessPage({ isAuthenticated, orderId }: CheckoutSuccessPageProps) {
  return (
    <main className="bg-background">
      <PaymentReturnAnalytics isAuthenticated={isAuthenticated} orderId={orderId} />
      {isAuthenticated ? <CheckoutSuccess orderId={orderId} /> : <GuestCheckoutSuccess />}
    </main>
  );
}
