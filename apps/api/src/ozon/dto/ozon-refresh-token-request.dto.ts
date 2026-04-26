import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class OzonRefreshTokenRequestDTO {
  @ApiPropertyOptional({
    description:
      "Optional refresh token override. If omitted, the API uses the token saved in DB or OZON_OAUTH_REFRESH_TOKEN.",
  })
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
