import { ApiProperty } from "@nestjs/swagger";
import { Equals } from "class-validator";

export class PartnerApplicationSubmissionResultDTO {
  @ApiProperty({ example: true })
  @Equals(true)
  accepted!: true;
}
