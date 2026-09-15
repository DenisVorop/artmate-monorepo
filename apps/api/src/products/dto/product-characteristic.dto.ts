import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsNotEmpty,
  IsString,
  MaxLength,
  Matches,
} from "class-validator";

export class ProductCharacteristicDTO {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  @Matches(/^[^<>]*$/u)
  name!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  @Matches(/^[^<>]*$/u)
  value!: string;

  @IsBoolean()
  isHighlighted!: boolean;
}
