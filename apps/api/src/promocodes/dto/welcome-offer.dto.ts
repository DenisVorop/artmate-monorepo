import { Type } from "class-transformer";
import {
  IsIn,
  IsISO8601,
  IsNumber,
  IsOptional,
  Min,
  ValidateNested,
} from "class-validator";

export class WelcomeOfferDTO {
  @IsIn(["authorize", "link_telegram"])
  action!: "authorize" | "link_telegram";

  @IsOptional() @IsNumber() @Min(0) discountPercent!: number | null;
  @IsOptional() @IsNumber() @Min(0) amount!: number | null;
  @IsNumber() @Min(0) minSubtotal!: number;
  @IsOptional() @IsNumber() @Min(0) maxDiscount!: number | null;
  @IsOptional() @IsISO8601() endsAt!: string | null;
}

export class WelcomeOfferResponseDTO {
  @IsOptional()
  @ValidateNested()
  @Type(() => WelcomeOfferDTO)
  offer!: WelcomeOfferDTO | null;
}
