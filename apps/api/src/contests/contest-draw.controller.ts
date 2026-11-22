import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import type { AuthUser } from "../auth/auth.types";
import { ContestAdminGuard } from "./contest-entries.controller";
import { ContestDrawService } from "./contest-draw.service";
import { ManualContestDrawRequestDTO } from "./dto/contest-draw-request.dto";

@Controller("admin/contests/:contestId/draw")
@UseGuards(AuthGuard, ContestAdminGuard)
export class ContestDrawController {
  constructor(private readonly draws: ContestDrawService) {}
  @Get()
  @Header("Cache-Control", "no-store")
  get(@Param("contestId") id: string) {
    return this.draws.getAdmin(id);
  }
  @Post()
  select(
    @Param("contestId") id: string,
    @Req() req: { user: AuthUser },
    @Body() body: ManualContestDrawRequestDTO,
  ) {
    return this.draws.selectManual(id, req.user.id, body);
  }
}
