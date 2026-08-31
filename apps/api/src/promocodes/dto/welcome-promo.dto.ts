import { Type } from "class-transformer";
import {
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from "class-validator";

export class WelcomePromoDTO {
  @IsString() code!: string;
  @IsOptional() @IsNumber() @Min(0) discountPercent!: number | null;
  @IsOptional() @IsNumber() @Min(0) amount!: number | null;
  @IsNumber() @Min(0) minSubtotal!: number;
  @IsOptional() @IsNumber() @Min(0) maxDiscount!: number | null;
  @IsOptional() @IsISO8601() endsAt!: string | null;
}

export class WelcomePromoResponseDTO {
  @IsOptional()
  @ValidateNested()
  @Type(() => WelcomePromoDTO)
  promo!: WelcomePromoDTO | null;
}
