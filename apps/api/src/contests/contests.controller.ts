import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import type { AuthUser } from "../auth/auth.types";
import { UsersService } from "../users/users.service";
import {
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
