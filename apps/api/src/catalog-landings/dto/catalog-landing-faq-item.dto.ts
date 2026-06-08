import { IsISO8601, IsInt, IsString, Min } from "class-validator";

export class CatalogLandingFaqItemDTO {
  @IsString()
  id!: string;

  @IsString()
  question!: string;

  @IsString()
  answerHtml!: string;

  @IsInt()
  @Min(0)
  sortOrder!: number;

  @IsISO8601()
  createdAt!: string;

  @IsISO8601()
  updatedAt!: string;
}
