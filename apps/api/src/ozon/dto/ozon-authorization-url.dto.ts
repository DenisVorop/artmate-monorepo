import { ApiProperty } from "@nestjs/swagger";

export class OzonAuthorizationUrlDTO {
  @ApiProperty({
    example:
      "https://seller.ozon.ru/app/appstore/oauth/authorize?response_type=code&access_type=offline&client_id=...",
  })
  url!: string;
}
