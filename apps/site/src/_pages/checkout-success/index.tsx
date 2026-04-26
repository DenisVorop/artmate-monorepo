import { CheckoutSuccess } from "@/features/checkout";

type CheckoutSuccessPageProps = {
  orderId?: string;
};

export function CheckoutSuccessPage({ orderId }: CheckoutSuccessPageProps) {
  return (
    <main className="bg-background">
      <CheckoutSuccess orderId={orderId} />
    </main>
  );
}
