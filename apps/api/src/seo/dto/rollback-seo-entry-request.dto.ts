import { IsOptional, IsString, MaxLength } from "class-validator";

export class RollbackSeoEntryRequestDTO {
  @IsString()
  snapshotId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string | null;
}
