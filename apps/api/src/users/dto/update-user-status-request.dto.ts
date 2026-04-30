import { IsIn } from "class-validator";

import {
  manageableUserStatuses,
  type ManageableUserStatus,
} from "../users.types";

export class UpdateUserStatusRequestDTO {
  @IsIn(manageableUserStatuses)
  status!: ManageableUserStatus;
}
