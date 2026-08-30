import { ApiProperty, PartialType } from "@nestjs/swagger";
import { IsISO8601 } from "class-validator";

import { CreateColoringCollectionRequestDTO } from "./create-coloring-collection-request.dto";

export class UpdateColoringCollectionRequestDTO extends PartialType(
  CreateColoringCollectionRequestDTO,
  { skipNullProperties: false },
) {
  @ApiProperty({ format: "date-time" })
  @IsISO8601()
  updatedAt!: string;
}
