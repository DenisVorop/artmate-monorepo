import { Equals, IsString, MaxLength, MinLength } from "class-validator";

export class ReleasePromoRedemptionDTO {
  @Equals("payment_closed_without_charge")
  confirmation!: "payment_closed_without_charge";

  @IsString()
  @MinLength(10)
  @MaxLength(500)
  reason!: string;
}
