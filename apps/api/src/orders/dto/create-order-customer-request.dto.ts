import { Transform } from "class-transformer";
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  Matches,
} from "class-validator";

const russianNamePattern = /^[А-ЯЁа-яё]+(?:[ -][А-ЯЁа-яё]+)*$/;
const phonePattern = /^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$/;
const trimString = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim() : value;

export class CreateOrderCustomerRequestDTO {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  @Matches(russianNamePattern)
  name!: string;

  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(18)
  @Matches(phonePattern)
  phone!: string;

  @Transform(trimString)
  @IsEmail()
  @MaxLength(254)
  email!: string;
}
