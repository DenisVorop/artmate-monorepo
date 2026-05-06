import { IsString } from "class-validator";

export class BlogImageUploadDTO {
  @IsString()
  url!: string;
}
