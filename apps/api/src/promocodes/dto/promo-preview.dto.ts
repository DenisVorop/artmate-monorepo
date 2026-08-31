import { IsIn, IsNumber, IsString, Min } from "class-validator";

export class PromoPreviewDTO {
  @IsString() code!: string;
  @IsString() cartId!: string;
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(0)
  subtotal!: number;
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(0)
  discount!: number;
  @IsNumber({ allowInfinity: false, allowNaN: false }) @Min(0) total!: number;
  @IsIn(["RUB"]) currency!: "RUB";
}
