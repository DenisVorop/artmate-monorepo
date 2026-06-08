import { IsInt, IsString, MaxLength, Min } from "class-validator";

export class CatalogLandingFaqItemInputDTO {
  @IsString()
  @MaxLength(300)
  question!: string;

  @IsString()
  @MaxLength(8000)
  answerHtml!: string;

  @IsInt()
  @Min(0)
  sortOrder!: number;
}
