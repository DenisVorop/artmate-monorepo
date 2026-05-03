import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";

import { AuthGuard } from "../auth/auth.guard";
import type { AuthUser } from "../auth/auth.types";
import { ValidateResponse } from "../common/response-validation.interceptor";
import { UsersService } from "../users/users.service";

import { BlogService } from "./blog.service";
import {
  BlogAuthorDTO,
  BlogCategoryDTO,
  BlogPostDTO,
  BlogTagDTO,
  CreateBlogAuthorRequestDTO,
  CreateBlogCategoryRequestDTO,
  CreateBlogPostRequestDTO,
  CreateBlogTagRequestDTO,
  UpdateBlogPostRequestDTO,
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
}
