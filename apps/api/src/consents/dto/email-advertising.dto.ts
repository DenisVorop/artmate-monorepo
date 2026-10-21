import {
  Equals,
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  MinLength,
  MaxLength,
  IsString,
  Matches,
  Min,
} from "class-validator";

export class EmailAdvertisingStatusDTO {
  @IsEmail() email!: string;
  @IsBoolean() subscribed!: boolean;
  @IsInt() @Min(0) version!: number;
  @IsOptional() @IsString() @MinLength(1) grantRevisionId?: string;
  @IsInt() @Min(0) stateRevision!: number;
}
export class UnsubscribeQueryDTO {
  @IsString() @Matches(/^[A-Za-z0-9_-]{43}$/) token!: string;
}
export class UnsubscribeConfirmDTO extends UnsubscribeQueryDTO {}
export class UnsubscribeOneClickDTO {
  @Equals("One-Click") "List-Unsubscribe"!: "One-Click";
}
export class UnsubscribeResultDTO {
  @Equals(true) unsubscribed!: true;
}

export class GrantEmailAdvertisingDTO {
  @IsString() @MinLength(1) @MaxLength(128) revisionId!: string;
  @IsInt() @Min(0) expectedVersion!: number;
  @IsInt() @Min(0) expectedStateRevision!: number;
}
