import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean } from "class-validator";

export class ContactMessageResultDTO {
  @ApiProperty({ example: true })
  @IsBoolean()
  sent!: boolean;
}
