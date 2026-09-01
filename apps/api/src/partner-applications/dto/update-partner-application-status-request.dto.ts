import { IsIn } from "class-validator";

import {
  partnerApplicationStatuses,
  type PartnerApplicationStatus,
} from "../partner-applications.types";

export class UpdatePartnerApplicationStatusRequestDTO {
  @IsIn(partnerApplicationStatuses)
  status!: PartnerApplicationStatus;
}
