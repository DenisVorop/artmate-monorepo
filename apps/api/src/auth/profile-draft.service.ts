import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CustomerProfileValues } from "../users/contracts/customer-profile-values";
import { AuthFlowStore } from "./flow.store";
import { CustomerDirectoryReader } from "./customer-directory.reader";
import { FlowCredentials } from "./flow-credentials";
import type {
  AuthFlowCredentials,
  AuthFlowResponseV1,
} from "./contracts/flow-response.contract";
import type { ProfileDraftDTO } from "./dto/profile-draft.dto";

/** Auth stores only an expiring draft. Users applies it via its inbox at completion. */
@Injectable()
export class ProfileDraftService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly store: AuthFlowStore,
    private readonly directory: CustomerDirectoryReader,
  ) {}

  public async save(
    actor: AuthFlowCredentials,
    input: ProfileDraftDTO,
  ): Promise<AuthFlowResponseV1> {
    FlowCredentials.validate(actor);
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM auth_pending_flows WHERE capability_hash = ${FlowCredentials.capabilityHash(actor)} FOR UPDATE`;
      const flow = await this.store.find(tx, actor);
      if (!flow)
        throw new UnauthorizedException(
          "Auth continuation is missing or expired",
        );
      const state = await this.store.state(tx, flow);
      if (
        state.status !== "PENDING" ||
        !["profile", "preparing"].includes(state.nextStep)
      )
        throw new ConflictException("Complete authentication first");
      const current = flow.userIdSnapshot
        ? await this.directory.byId(tx, flow.userIdSnapshot)
        : null;
      const profile = CustomerProfileValues.select(current, input);
      if (profile.missingFields.length)
        throw new BadRequestException("Invalid name or phone");
      const saved = await tx.authPendingFlow.update({
        where: { id: flow.id },
        data: {
          draftName: profile.name,
          draftPhone: profile.phone,
          profileRevision: current?.profileRevision ?? null,
        },
      });
      return this.store.state(tx, saved);
    });
  }
}
