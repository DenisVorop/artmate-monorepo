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

export class CreateBlogPostRequestDTO {
  @IsString()
  @MaxLength(220)
  title!: string;

  @IsString()
  @MaxLength(180)
  slug!: string;

  @IsString()
  @MaxLength(12000)
  excerpt!: string;

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

  @IsString()
  @MaxLength(32)
  authorId!: string;

  @IsString()
  @MaxLength(32)
  categoryId!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(32, { each: true })
  tagIds?: string[];

  @IsOptional()
  @Allow()
  content?: BlogPostContent | null;
}
