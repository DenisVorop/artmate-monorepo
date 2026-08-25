import { Help } from "./ui/help";
import { Hero } from "./ui/hero";
import { OrderSteps } from "./ui/order-steps";
import { ServiceDetails } from "./ui/service-details";

export function PaymentAndDeliveryPage() {
  return (
    <main className="overflow-hidden bg-background">
      <Hero />
      <OrderSteps />
      <ServiceDetails />
      <Help />
    </main>
  );
}
