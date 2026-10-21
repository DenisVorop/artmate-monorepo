import { IsString, IsUUID, MaxLength, MinLength } from "class-validator";

export class ExchangeOrderActivationDTO {
  @IsString() @MinLength(32) @MaxLength(256) token!: string;
}

export class ActivationPasswordDraftDTO {
  @IsString() @MinLength(8) password!: string;
  @IsString() @MinLength(8) passwordConfirm!: string;
  @IsUUID() operationKey!: string;
}

export class ConfirmRecoveryPasswordDTO extends ExchangeOrderActivationDTO {
  @IsString() @MinLength(8) password!: string;
  @IsString() @MinLength(8) passwordConfirm!: string;
}
