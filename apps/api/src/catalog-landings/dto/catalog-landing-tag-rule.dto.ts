import { Type } from "class-transformer";
import { IsIn, IsString, ValidateNested } from "class-validator";

import { ProductTagDTO } from "../../products/dto";
import {
  catalogLandingTagRuleModes,
  type CatalogLandingTagRuleMode,
} from "../catalog-landings.types";

export class CatalogLandingTagRuleDTO {
  @IsString()
  tagId!: string;

  @IsIn(catalogLandingTagRuleModes)
  mode!: CatalogLandingTagRuleMode;

  @ValidateNested()
  @Type(() => ProductTagDTO)
  tag!: ProductTagDTO;
}
