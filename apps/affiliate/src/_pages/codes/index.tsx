import { AffiliateCodes } from "@/features/affiliate-codes";
import { CabinetShell } from "@/widgets/cabinet-shell";

export function CodesPage() {
  return (
    <CabinetShell activeRoute="/codes">
      <AffiliateCodes />
    </CabinetShell>
  );
}
