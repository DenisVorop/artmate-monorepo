import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsString,
  MaxLength,
  Matches,
  Validate,
  ValidateIf,
  ValidateNested,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
} from "class-validator";

import { parseProductCharacteristics } from "../product-content";
import { ProductCharacteristicDTO } from "./product-characteristic.dto";

@ValidatorConstraint({ name: "productCharacteristics", async: false })
class ProductCharacteristicsConstraint implements ValidatorConstraintInterface {
  validate(value: unknown) {
    try {
      parseProductCharacteristics(value);
      return true;
    } catch {
      return false;
    }
  }

  defaultMessage() {
    return "characteristics must contain at most 30 valid unique names and at most 2 highlighted items";
  }
}

export class ProductContentRequestDTO {
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => ProductCharacteristicDTO)
  @Validate(ProductCharacteristicsConstraint)
  characteristics?: ProductCharacteristicDTO[];

  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @MaxLength(6000)
  @Matches(/^[^<>]*$/u)
  usageInstructions?: string;
}
