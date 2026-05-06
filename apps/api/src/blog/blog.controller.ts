import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import {
  ApiConsumes,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { FileInterceptor } from "@nestjs/platform-express";

import { AuthGuard } from "../auth/auth.guard";
import type { AuthUser } from "../auth/auth.types";
import { ValidateResponse } from "../common/response-validation.interceptor";
import { UsersService } from "../users/users.service";

import {
  BlogService,
  maxBlogImageSizeBytes,
  type UploadedBlogImageFile,
} from "./blog.service";
import {
  BlogAuthorDTO,
  BlogCategoryDTO,
  BlogImageUploadDTO,
  BlogPostDTO,
  BlogTagDTO,
  CreateBlogAuthorRequestDTO,
  CreateBlogCategoryRequestDTO,
  CreateBlogPostRequestDTO,
  CreateBlogTagRequestDTO,
  UpdateBlogAuthorRequestDTO,
  UpdateBlogCategoryRequestDTO,
  UpdateBlogPostRequestDTO,
  UpdateBlogTagRequestDTO,
} from "./dto";

type AuthenticatedRequest = {
  user: AuthUser;
};

@ApiTags("Blog")
@Controller("blog/posts")
export class PublicBlogController {
  constructor(private readonly blogService: BlogService) {}

  @ValidateResponse(BlogPostDTO, { isArray: true })
  @ApiOperation({ summary: "List published blog posts" })
  @ApiOkResponse({ type: [BlogPostDTO] })
  @Get()
  getPosts() {
    return this.blogService.getPublishedPosts();
  }

  @ValidateResponse(BlogPostDTO)
  @ApiOperation({ summary: "Get published blog post by slug" })
  @ApiOkResponse({ type: BlogPostDTO })
  @Get(":slug")
  getPost(@Param("slug") slug: string) {
    return this.blogService.getPublishedPostBySlug(slug);
  }
}

@ApiTags("Blog")
@UseGuards(AuthGuard)
@Controller("blog/admin")
export class AdminBlogController {
  constructor(
    private readonly blogService: BlogService,
    private readonly usersService: UsersService,
  ) {}

  @ValidateResponse(BlogPostDTO, { isArray: true })
  @ApiOperation({ summary: "List blog posts for admin panel" })
  @ApiOkResponse({ type: [BlogPostDTO] })
  @Get("posts")
  getPosts(@Req() request: AuthenticatedRequest) {
    this.usersService.assertRole(request.user, "admin");

    return this.blogService.getAdminPosts();
  }

  @ValidateResponse(BlogPostDTO)
  @ApiOperation({ summary: "Get blog post for admin panel" })
  @ApiOkResponse({ type: BlogPostDTO })
  @Get("posts/:id")
  getPost(@Param("id") postId: string, @Req() request: AuthenticatedRequest) {
    this.usersService.assertRole(request.user, "admin");

    return this.blogService.getAdminPost(postId);
  }

  @ValidateResponse(BlogPostDTO)
  @ApiOperation({ summary: "Create blog post from admin panel" })
  @ApiCreatedResponse({ type: BlogPostDTO })
  @Post("posts")
  createPost(
    @Body() body: CreateBlogPostRequestDTO,
    @Req() request: AuthenticatedRequest,
  ) {
    this.usersService.assertRole(request.user, "admin");

    return this.blogService.createPost(body, request.user.id);
  }

  @ValidateResponse(BlogPostDTO)
  @ApiOperation({ summary: "Update blog post from admin panel" })
  @ApiOkResponse({ type: BlogPostDTO })
  @Patch("posts/:id")
  updatePost(
    @Param("id") postId: string,
    @Body() body: UpdateBlogPostRequestDTO,
    @Req() request: AuthenticatedRequest,
  ) {
    this.usersService.assertRole(request.user, "admin");

    return this.blogService.updatePost(postId, body);
  }

  @ValidateResponse(BlogPostDTO)
  @ApiOperation({ summary: "Delete blog post from admin panel" })
  @ApiOkResponse({ type: BlogPostDTO })
  @Delete("posts/:id")
  deletePost(
    @Param("id") postId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    this.usersService.assertRole(request.user, "admin");

    return this.blogService.deletePost(postId);
  }

  @ValidateResponse(BlogImageUploadDTO)
  @ApiConsumes("multipart/form-data")
  @ApiOperation({ summary: "Upload blog image from admin panel" })
  @ApiCreatedResponse({ type: BlogImageUploadDTO })
  @Post("images")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: {
        fileSize: maxBlogImageSizeBytes,
      },
    }),
  )
  uploadImage(
    @UploadedFile() file: UploadedBlogImageFile | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    this.usersService.assertRole(request.user, "admin");

    return this.blogService.uploadImage(file);
  }

  @ValidateResponse(BlogAuthorDTO, { isArray: true })
  @ApiOperation({ summary: "List blog authors for admin panel" })
  @ApiOkResponse({ type: [BlogAuthorDTO] })
  @Get("authors")
  getAuthors(@Req() request: AuthenticatedRequest) {
    this.usersService.assertRole(request.user, "admin");

    return this.blogService.getAuthors();
  }

  @ValidateResponse(BlogAuthorDTO)
  @ApiOperation({ summary: "Create blog author from admin panel" })
  @ApiCreatedResponse({ type: BlogAuthorDTO })
  @Post("authors")
  createAuthor(
    @Body() body: CreateBlogAuthorRequestDTO,
    @Req() request: AuthenticatedRequest,
  ) {
    this.usersService.assertRole(request.user, "admin");

    return this.blogService.createAuthor(body);
  }

  @ValidateResponse(BlogAuthorDTO)
  @ApiOperation({ summary: "Update blog author from admin panel" })
  @ApiOkResponse({ type: BlogAuthorDTO })
  @Patch("authors/:id")
  updateAuthor(
    @Param("id") authorId: string,
    @Body() body: UpdateBlogAuthorRequestDTO,
    @Req() request: AuthenticatedRequest,
  ) {
    this.usersService.assertRole(request.user, "admin");

    return this.blogService.updateAuthor(authorId, body);
  }

  @ValidateResponse(BlogAuthorDTO)
  @ApiOperation({ summary: "Delete blog author from admin panel" })
  @ApiOkResponse({ type: BlogAuthorDTO })
  @Delete("authors/:id")
  deleteAuthor(
    @Param("id") authorId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    this.usersService.assertRole(request.user, "admin");

    return this.blogService.deleteAuthor(authorId);
  }

  @ValidateResponse(BlogCategoryDTO, { isArray: true })
  @ApiOperation({ summary: "List blog categories for admin panel" })
  @ApiOkResponse({ type: [BlogCategoryDTO] })
  @Get("categories")
  getCategories(@Req() request: AuthenticatedRequest) {
    this.usersService.assertRole(request.user, "admin");

    return this.blogService.getCategories();
  }

  @ValidateResponse(BlogCategoryDTO)
  @ApiOperation({ summary: "Create blog category from admin panel" })
  @ApiCreatedResponse({ type: BlogCategoryDTO })
  @Post("categories")
  createCategory(
    @Body() body: CreateBlogCategoryRequestDTO,
    @Req() request: AuthenticatedRequest,
  ) {
    this.usersService.assertRole(request.user, "admin");

    return this.blogService.createCategory(body);
  }

  @ValidateResponse(BlogCategoryDTO)
  @ApiOperation({ summary: "Update blog category from admin panel" })
  @ApiOkResponse({ type: BlogCategoryDTO })
  @Patch("categories/:id")
  updateCategory(
    @Param("id") categoryId: string,
    @Body() body: UpdateBlogCategoryRequestDTO,
    @Req() request: AuthenticatedRequest,
  ) {
    this.usersService.assertRole(request.user, "admin");

    return this.blogService.updateCategory(categoryId, body);
  }

  @ValidateResponse(BlogCategoryDTO)
  @ApiOperation({ summary: "Delete blog category from admin panel" })
  @ApiOkResponse({ type: BlogCategoryDTO })
  @Delete("categories/:id")
  deleteCategory(
    @Param("id") categoryId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    this.usersService.assertRole(request.user, "admin");

    return this.blogService.deleteCategory(categoryId);
  }

  @ValidateResponse(BlogTagDTO, { isArray: true })
  @ApiOperation({ summary: "List blog tags for admin panel" })
  @ApiOkResponse({ type: [BlogTagDTO] })
  @Get("tags")
  getTags(@Req() request: AuthenticatedRequest) {
    this.usersService.assertRole(request.user, "admin");

    return this.blogService.getTags();
  }

  @ValidateResponse(BlogTagDTO)
  @ApiOperation({ summary: "Create blog tag from admin panel" })
  @ApiCreatedResponse({ type: BlogTagDTO })
  @Post("tags")
  createTag(
    @Body() body: CreateBlogTagRequestDTO,
    @Req() request: AuthenticatedRequest,
  ) {
    this.usersService.assertRole(request.user, "admin");

    return this.blogService.createTag(body);
  }

  @ValidateResponse(BlogTagDTO)
  @ApiOperation({ summary: "Update blog tag from admin panel" })
  @ApiOkResponse({ type: BlogTagDTO })
  @Patch("tags/:id")
  updateTag(
    @Param("id") tagId: string,
    @Body() body: UpdateBlogTagRequestDTO,
    @Req() request: AuthenticatedRequest,
  ) {
    this.usersService.assertRole(request.user, "admin");

    return this.blogService.updateTag(tagId, body);
  }

  @ValidateResponse(BlogTagDTO)
  @ApiOperation({ summary: "Delete blog tag from admin panel" })
  @ApiOkResponse({ type: BlogTagDTO })
  @Delete("tags/:id")
  deleteTag(@Param("id") tagId: string, @Req() request: AuthenticatedRequest) {
    this.usersService.assertRole(request.user, "admin");

    return this.blogService.deleteTag(tagId);
  }
}
