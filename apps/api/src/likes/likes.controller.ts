import {
  BadRequestException,
  Body,
  Controller,
  ConflictException,
  Delete,
  Header,
  Headers,
  HttpCode,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { AuthGuard } from "../auth/auth.guard";
import { ValidateResponse } from "../common/response-validation.interceptor";
import {
  LikeBatchDTO,
  LikeBatchRequestDTO,
  LikeStateDTO,
  LikeSubjectDTO,
} from "./dto";
import { LikesService } from "./likes.service";
import { OptionalLikeAuthGuard, type LikeRequest } from "./optional-auth.guard";

@ApiTags("Likes")
@Controller("likes")
export class LikesController {
  constructor(private readonly likes: LikesService) {}

  @Post("batch")
  @HttpCode(200)
  @Header("Cache-Control", "private, no-store")
  @UseGuards(OptionalLikeAuthGuard)
  @ApiOperation({
    summary:
      "Read likes for up to 100 subjects; unavailable subjects are omitted",
  })
  @ApiOkResponse({ type: LikeBatchDTO })
  @ValidateResponse(LikeBatchDTO)
  batch(
    @Body() body: LikeBatchRequestDTO,
    @Req() request: LikeRequest,
    @Headers("x-artmate-like-actor") expectedActor?: string,
  ) {
    this.assertActor(request, expectedActor);
    return this.likes.batch(body.subjects, request.user?.id);
  }

  @Put(":subjectType/:subjectId/me")
  @Header("Cache-Control", "private, no-store")
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiBody({
    required: false,
    schema: { type: "object", additionalProperties: false },
  })
  @ApiOkResponse({ type: LikeStateDTO })
  @ValidateResponse(LikeStateDTO)
  put(
    @Param() subject: LikeSubjectDTO,
    @Req() request: LikeRequest,
    @Body() body?: unknown,
    @Headers("x-artmate-like-actor") expectedActor?: string,
  ) {
    this.assertActor(request, expectedActor);
    this.assertEmptyBody(body);
    return this.likes.set(subject, request.user!.id, true);
  }

  @Delete(":subjectType/:subjectId/me")
  @Header("Cache-Control", "private, no-store")
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiBody({
    required: false,
    schema: { type: "object", additionalProperties: false },
  })
  @ApiOkResponse({ type: LikeStateDTO })
  @ValidateResponse(LikeStateDTO)
  remove(
    @Param() subject: LikeSubjectDTO,
    @Req() request: LikeRequest,
    @Body() body?: unknown,
    @Headers("x-artmate-like-actor") expectedActor?: string,
  ) {
    this.assertActor(request, expectedActor);
    this.assertEmptyBody(body);
    return this.likes.set(subject, request.user!.id, false);
  }

  private assertEmptyBody(body: unknown) {
    if (
      body !== undefined &&
      (body === null ||
        typeof body !== "object" ||
        Array.isArray(body) ||
        Object.keys(body).length)
    )
      throw new BadRequestException("This operation does not accept a payload");
  }

  // A client precondition binds in-flight operations to their account. It never
  // selects or authenticates the actor; AuthGuard remains authoritative.
  private assertActor(request: LikeRequest, expectedActor?: string) {
    if (
      expectedActor !== undefined &&
      expectedActor !== (request.user?.id ?? "guest")
    )
      throw new ConflictException("Like account changed");
  }
}
