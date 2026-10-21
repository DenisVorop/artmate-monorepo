import {
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from "class-validator";

export class YandexCallbackDTO {
  @IsString() @Matches(/^[A-Za-z0-9_-]{43}$/) state!: string;
  @IsOptional() @IsString() @Length(1, 2048) code?: string;
  @IsOptional() @IsString() @MaxLength(128) error?: string;
}

export class YandexResultQueryDTO {
  @IsString() @Matches(/^[a-zA-Z0-9_-]{1,128}$/) attemptId!: string;
}
