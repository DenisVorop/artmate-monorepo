import {
  Controller,
  Header,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiHeader,
  ApiProperty,
  ApiTags,
} from "@nestjs/swagger";
import { IsString, IsUrl, Matches } from "class-validator";
import { AuthGuard } from "../auth/auth.guard";
import { ValidateResponse } from "../common/response-validation.interceptor";
import { AdminAchievementsGuard } from "./admin-achievements.guard";
import {
  LoyaltyAchievementImageService,
  maxAchievementImageBytes,
  type UploadedAchievementImage,
} from "./achievement-image.service";

export class AchievementImageUploadDTO {
  @ApiProperty({ format: "uri" })
  @IsString()
  @Matches(/^https?:\/\//)
  @IsUrl({
    protocols: ["http", "https"],
    require_protocol: true,
    require_tld: false,
  })
  url!: string;
}

@ApiTags("Loyalty")
@ApiBearerAuth()
@UseGuards(AuthGuard, AdminAchievementsGuard)
@Controller("loyalty/admin/achievements/images")
export class LoyaltyAchievementImageController {
  constructor(private readonly images: LoyaltyAchievementImageService) {}

  @Post()
  @Header("Cache-Control", "private, no-store")
  @ApiHeader({
    name: "x-artmate-csrf",
    required: true,
    schema: { enum: ["1"] },
  })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      required: ["file"],
      properties: {
        file: { type: "string", format: "binary" },
      },
    },
  })
  @ApiCreatedResponse({ type: AchievementImageUploadDTO })
  @ValidateResponse(AchievementImageUploadDTO)
  @UseInterceptors(
    FileInterceptor("file", {
      limits: {
        fileSize: maxAchievementImageBytes,
        files: 1,
        fields: 0,
        // Busboy reports partsLimit upon reaching this count; one file needs 2.
        parts: 2,
      },
    }),
  )
  upload(@UploadedFile() file: UploadedAchievementImage | undefined) {
    return this.images.upload(file);
  }
}
