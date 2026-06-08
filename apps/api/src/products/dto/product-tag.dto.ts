import { IsISO8601, IsIn, IsString } from "class-validator";

import { productTagGroups, type ProductTagGroup } from "../products.types";

export class ProductTagDTO {
  @IsString()
  id!: string;

  @IsString()
  slug!: string;

  @IsString()
  title!: string;

  @IsIn(productTagGroups)
  group!: ProductTagGroup;

  @IsISO8601()
  createdAt!: string;

  @IsISO8601()
  updatedAt!: string;
}
