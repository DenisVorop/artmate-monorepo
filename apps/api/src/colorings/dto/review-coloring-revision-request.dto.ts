import { Transform } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsIn,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from "class-validator";

export class ReviewColoringRevisionRequestDTO {
  @ApiProperty({ enum: ["approved", "rejected"] })
  @IsIn(["approved", "rejected"])
  decision!: "approved" | "rejected";

  @ApiPropertyOptional({ minLength: 1, maxLength: 4000 })
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value !== "string") {
      return value;
    }

    return value.trim() || undefined;
  })
  @ValidateIf(
    (object: ReviewColoringRevisionRequestDTO, value: unknown) =>
      object.decision === "rejected" || value !== undefined,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  comment?: string;
}
