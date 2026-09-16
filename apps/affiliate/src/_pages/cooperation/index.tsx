import { CooperationDetails } from "@/features/cooperation-details";
import { CabinetShell } from "@/widgets/cabinet-shell";

export function CooperationPage() {
  return (
    <CabinetShell activeRoute="/cooperation">
      <CooperationDetails />
    </CabinetShell>
  );
}
