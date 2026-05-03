import { Type } from "class-transformer";
import {
  Allow,
  IsArray,
  IsBoolean,
  IsISO8601,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from "class-validator";

import {
  blogPostStatuses,
  type BlogPostContent,
  type BlogPostStatus,
} from "../blog.types";

import { BlogAuthorDTO } from "./blog-author.dto";
import { BlogCategoryDTO } from "./blog-category.dto";
import { BlogTagDTO } from "./blog-tag.dto";

export class BlogPostDTO {
  @IsString()
  id!: string;

  @IsString()
  slug!: string;

  @IsString()
  title!: string;

  @IsString()
  excerpt!: string;

  @IsIn(blogPostStatuses)
  status!: BlogPostStatus;

  @IsBoolean()
  featured!: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  readTimeMinutes?: number;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  imageAlt?: string;

  @IsOptional()
  @IsString()
  metaTitle?: string;

  @IsOptional()
  @IsString()
  metaDescription?: string;

  @IsOptional()
  @IsISO8601()
  publishedAt?: string;

  @IsISO8601()
  createdAt!: string;

  @IsISO8601()
  updatedAt!: string;

  @IsString()
  authorId!: string;

  @IsString()
  categoryId!: string;

  @ValidateNested()
  @Type(() => BlogAuthorDTO)
  author!: BlogAuthorDTO;

  @ValidateNested()
  @Type(() => BlogCategoryDTO)
  category!: BlogCategoryDTO;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BlogTagDTO)
  tags!: BlogTagDTO[];

  @IsOptional()
  @Allow()
  content?: BlogPostContent | null;
}
