import { PartnerOverview } from "@/features/partner-overview";
import { CabinetShell } from "@/widgets/cabinet-shell";

export function OverviewPage() {
  return (
    <CabinetShell activeRoute="/">
      <PartnerOverview />
    </CabinetShell>
  );
}
