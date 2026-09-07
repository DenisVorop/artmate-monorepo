import { CheckoutSuccess, GuestCheckoutSuccess } from "@/features/checkout";

type CheckoutSuccessPageProps = {
  isAuthenticated: boolean;
  orderId?: string;
};

export function CheckoutSuccessPage({ isAuthenticated, orderId }: CheckoutSuccessPageProps) {
  return (
    <main className="bg-background">
      {isAuthenticated ? <CheckoutSuccess orderId={orderId} /> : <GuestCheckoutSuccess />}
    </main>
  );
}
