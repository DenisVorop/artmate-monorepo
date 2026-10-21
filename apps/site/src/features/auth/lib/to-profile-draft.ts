import type { ProfileDraftInputDTO } from "@/shared/actions/auth";
import type { ContactProfileValues } from "./flow-form-values";

export function toProfileDraft(values: ContactProfileValues): ProfileDraftInputDTO {
  return {
    name: values.name.trim(),
    phone: values.phone.replace(/[\s()-]/g, ""),
  };
}
