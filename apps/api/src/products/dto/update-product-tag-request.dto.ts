import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";

import { productTagGroups, type ProductTagGroup } from "../products.types";

export class UpdateProductTagRequestDTO {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsIn(productTagGroups)
  group?: ProductTagGroup;
}
