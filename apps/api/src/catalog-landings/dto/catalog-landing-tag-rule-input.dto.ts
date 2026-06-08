import { IsIn, IsString, MaxLength } from "class-validator";

import {
  catalogLandingTagRuleModes,
  type CatalogLandingTagRuleMode,
} from "../catalog-landings.types";

export class CatalogLandingTagRuleInputDTO {
  @IsString()
  @MaxLength(32)
  tagId!: string;

  @IsIn(catalogLandingTagRuleModes)
  mode!: CatalogLandingTagRuleMode;
}
