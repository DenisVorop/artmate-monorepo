import { CheckoutPage } from "@/pages/checkout";
import { metadata } from "@/pages/checkout/metadata";
import { getOzonPickupPoints } from "@/shared/actions/orders";

export { metadata };

export default async function Page() {
  const pickupPointsResult = await getOzonPickupPoints();

  return (
    <CheckoutPage
      pickupPoints={pickupPointsResult.data ?? []}
      isPickupPointsError={pickupPointsResult.isError}
    />
  );
}
