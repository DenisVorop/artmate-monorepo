import {
  Allow,
  IsArray,
  IsBoolean,
  IsISO8601,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from "class-validator";

import {
  blogPostStatuses,
  type BlogPostContent,
  type BlogPostStatus,
} from "../blog.types";

export class UpdateBlogPostRequestDTO {
  @IsOptional()
  @IsString()
  @MaxLength(220)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(12000)
  excerpt?: string;

  @IsOptional()
  @IsIn(blogPostStatuses)
  status?: BlogPostStatus;

  @IsOptional()
  @IsBoolean()
  featured?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  readTimeMinutes?: number | null;

  @IsOptional()
  @IsString()
  imageUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(220)
  imageAlt?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(220)
  metaTitle?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(12000)
  metaDescription?: string | null;

  @IsOptional()
  @IsISO8601()
  publishedAt?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  authorId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  categoryId?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(32, { each: true })
  tagIds?: string[];

  @IsOptional()
  @Allow()
  content?: BlogPostContent | null;
}
