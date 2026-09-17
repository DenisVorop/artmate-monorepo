import { AffiliatePayouts } from "@/features/affiliate-payouts";
import { CabinetShell } from "@/widgets/cabinet-shell";

export function PayoutsPage() {
  return (
    <CabinetShell activeRoute="/payouts">
      <AffiliatePayouts />
    </CabinetShell>
  );
}
