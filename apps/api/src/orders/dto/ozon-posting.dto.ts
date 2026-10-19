import { IsIn, IsString, Matches, MaxLength } from "class-validator";

import type { OzonPosting } from "../../delivery-tracking/ozon-postings";

export class OzonPostingDTO implements OzonPosting {
  @IsString()
  @MaxLength(64)
  @Matches(/^\d+-\d+-\d+$/)
  number!: string;

  @IsIn(["fbo", "fbs"])
  scheme!: OzonPosting["scheme"];
}
