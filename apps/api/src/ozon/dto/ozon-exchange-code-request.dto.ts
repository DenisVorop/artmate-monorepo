import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";

export class OzonExchangeCodeRequestDTO {
  @ApiProperty({
    description: "Authorization code from Ozon callback URL.",
  })
  @IsString()
  @MinLength(1)
  code!: string;

  @ApiProperty({
    description: "State from the same Ozon callback URL.",
  })
  @IsString()
  @MinLength(1)
  state!: string;
}
