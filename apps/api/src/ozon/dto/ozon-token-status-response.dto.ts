import { ApiProperty } from "@nestjs/swagger";

import { OzonTokenStatusDTO } from "./ozon-token-status.dto";

export class OzonTokenStatusResponseDTO {
  @ApiProperty({ example: true })
  ok!: boolean;

  @ApiProperty({ type: OzonTokenStatusDTO })
  token!: OzonTokenStatusDTO;
}
