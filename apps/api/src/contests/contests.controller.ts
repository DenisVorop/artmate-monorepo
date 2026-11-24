import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import type { AuthUser } from "../auth/auth.types";
import { UsersService } from "../users/users.service";
import {
  BindContestPrizeProductRequestDTO,
  CreateContestRequestDTO,
  UpdateContestRequestDTO,
} from "./dto/contest-request.dto";
import { ContestsService } from "./contests.service";

@Controller("admin/contests")
@UseGuards(AuthGuard)
export class AdminContestsController {
  constructor(
    private readonly contests: ContestsService,
    private readonly users: UsersService,
  ) {}
  @Get() list(@Req() req: { user: AuthUser }) {
    this.users.assertRole(req.user, "admin");
    return this.contests.listAdmin();
  }
  @Get(":id") get(@Param("id") id: string, @Req() req: { user: AuthUser }) {
    this.users.assertRole(req.user, "admin");
    return this.contests.getAdmin(id);
  }
  @Post() create(
    @Body() body: CreateContestRequestDTO,
    @Req() req: { user: AuthUser },
  ) {
    this.users.assertRole(req.user, "admin");
    return this.contests.create(body);
  }
  @Patch(":id") update(
    @Param("id") id: string,
    @Body() body: UpdateContestRequestDTO,
    @Req() req: { user: AuthUser },
  ) {
    this.users.assertRole(req.user, "admin");
    return this.contests.update(id, body);
  }
  @Post(":id/prize-places/:place/product") bindPrizeProduct(
    @Param("id") id: string,
    @Param("place", ParseIntPipe) place: number,
    @Body() body: BindContestPrizeProductRequestDTO,
    @Req() req: { user: AuthUser },
  ) {
    this.users.assertRole(req.user, "admin");
    return this.contests.bindPrizeProduct(
      id,
      place,
      body.productId,
      req.user.id,
    );
  }
}
@Controller("contests")
export class PublicContestsController {
  constructor(private readonly contests: ContestsService) {}
  @Header("Cache-Control", "no-store")
  @Get()
  list() {
    return this.contests.listPublic();
  }
  @Header("Cache-Control", "no-store")
  @Get(":slug")
  get(@Param("slug") slug: string) {
    return this.contests.getPublic(slug);
  }
}
