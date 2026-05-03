import { Transform } from "class-transformer";
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

import {
  CONTACT_MESSAGE_EMAIL_MAX_LENGTH,
  CONTACT_MESSAGE_NAME_MAX_LENGTH,
  CONTACT_MESSAGE_ORDER_MAX_LENGTH,
  CONTACT_MESSAGE_TEXT_MAX_LENGTH,
  CONTACT_MESSAGE_TOPIC_MAX_LENGTH,
} from "../contacts.constants";

const Trim = () =>
  Transform(({ value }) => (typeof value === "string" ? value.trim() : value));

export class CreateContactMessageRequestDTO {
  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(CONTACT_MESSAGE_NAME_MAX_LENGTH)
  name!: string;

  @Trim()
  @IsEmail()
  @MaxLength(CONTACT_MESSAGE_EMAIL_MAX_LENGTH)
  email!: string;

  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(CONTACT_MESSAGE_TOPIC_MAX_LENGTH)
  topic?: string;

  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(CONTACT_MESSAGE_ORDER_MAX_LENGTH)
  order?: string;

  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(CONTACT_MESSAGE_TEXT_MAX_LENGTH)
  message!: string;
}
