import { ImportForm } from "./import-form";
import { MaterialSetsList } from "./list";

export function MaterialSetsManagement() {
  return (
    <div className="grid gap-6">
      <ImportForm />
      <MaterialSetsList />
    </div>
  );
}
