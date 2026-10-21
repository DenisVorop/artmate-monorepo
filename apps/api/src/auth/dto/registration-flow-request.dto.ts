import {
  IsEmail,
  IsInt,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

export class RequestRegistrationCodeDTO {
  @IsEmail() @MaxLength(320) email!: string;
}

export class ConfirmRegistrationCodeDTO {
  @IsString() @Matches(/^\d{6}$/) code!: string;
  @IsInt() @Min(1) @Max(100) generation!: number;
}

export class RegistrationDraftDTO {
  @IsString() @Length(1, 120) name!: string;
  @IsString() @MaxLength(80) phone!: string;
  @IsString() @MinLength(8) password!: string;
  @IsString() @MinLength(8) passwordConfirm!: string;
  @IsUUID() operationKey!: string;
}
