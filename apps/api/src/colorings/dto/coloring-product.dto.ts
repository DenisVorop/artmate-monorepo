import { ApiProperty } from "@nestjs/swagger";
import { IsString } from "class-validator";

export class ColoringProductDTO {
  @ApiProperty()
  @IsString()
  id!: string;

  @ApiProperty()
  @IsString()
  slug!: string;

  @ApiProperty()
  @IsString()
  title!: string;
}
