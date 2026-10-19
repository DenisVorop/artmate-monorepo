import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  ValidateNested,
} from "class-validator";

import { OzonPostingDTO } from "./ozon-posting.dto";

export class UpdateOrderOzonPostingsRequestDTO {
  @IsArray()
  @ArrayMaxSize(50)
  @ArrayUnique((posting: OzonPostingDTO) => posting?.number)
  @ValidateNested({ each: true })
  @Type(() => OzonPostingDTO)
  ozonPostings!: OzonPostingDTO[];
}
