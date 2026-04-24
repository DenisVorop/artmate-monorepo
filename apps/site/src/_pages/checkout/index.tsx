import { Checkout } from "@/features/checkout";
import type { OzonPickupPointDTO } from "@/shared/actions/orders";

type CheckoutPageProps = {
  pickupPoints: OzonPickupPointDTO[];
  isPickupPointsError?: boolean;
};

export function CheckoutPage({ pickupPoints, isPickupPointsError = false }: CheckoutPageProps) {
  return (
    <main className="bg-background">
      <Checkout pickupPoints={pickupPoints} isPickupPointsError={isPickupPointsError} />
    </main>
  );
}
