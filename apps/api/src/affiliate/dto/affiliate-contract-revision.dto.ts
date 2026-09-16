import { IsInt, IsISO8601, IsNotEmpty, IsString, Min } from "class-validator";

export class AffiliateContractRevisionDTO {
  @IsInt()
  @Min(1)
  version!: number;

  @IsString()
  @IsNotEmpty()
  number!: string;

  @IsISO8601({ strict: true })
  signedAt!: string;

  @IsString()
  @IsNotEmpty()
  paymentDetails!: string;

  @IsISO8601({ strict: true })
  changedAt!: string;

  @IsString()
  @IsNotEmpty()
  changedByUserId!: string;
}
