import { IsString, MaxLength } from "class-validator";
export class ProfileDraftDTO {
  @IsString() @MaxLength(120) name!: string;
  @IsString() @MaxLength(80) phone!: string;
}
