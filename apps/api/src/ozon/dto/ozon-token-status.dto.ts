import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class OzonTokenStatusDTO {
  @ApiProperty({ example: true })
  configured!: boolean;

  @ApiProperty({ example: true })
  hasAccessToken!: boolean;

  @ApiProperty({ example: true })
  hasRefreshToken!: boolean;

  @ApiProperty({ example: true })
  persisted!: boolean;

  @ApiPropertyOptional({ example: "2026-04-26T15:30:00.000Z" })
  expiresAt?: string;

  @ApiPropertyOptional({ example: "2026-04-26T14:30:00.000Z" })
  updatedAt?: string;

  @ApiProperty({ example: ["logistics"], type: [String] })
  scope!: string[];

  @ApiPropertyOptional({ example: "Bearer" })
  tokenType?: string;
}
