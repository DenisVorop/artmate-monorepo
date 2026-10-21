import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { CustomerProfileValues } from "../users/contracts/customer-profile-values";
import { PrismaService } from "../prisma/prisma.service";
import type {
  AuthFlowCredentials,
  AuthFlowResponseV1,
} from "./contracts/flow-response.contract";
import type { ActivationPasswordDraftDTO } from "./dto/link-flow-request.dto";
import type { RegistrationDraftDTO } from "./dto/registration-flow-request.dto";
import { CredentialsAuthService } from "./credentials-auth.service";
import { CustomerDirectoryReader } from "./customer-directory.reader";
import { AuthFlowStore } from "./flow.store";
import { FlowCredentials } from "./flow-credentials";
import { PasswordHasher } from "./password-hasher";

@Injectable()
export class RegistrationDraftService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly store: AuthFlowStore,
    private readonly directory: CustomerDirectoryReader,
    private readonly credentialsAuth: CredentialsAuthService,
  ) {}

  public async save(
    credentials: AuthFlowCredentials,
    input: RegistrationDraftDTO,
  ): Promise<AuthFlowResponseV1> {
    return this._save(credentials, input, "EMAIL_REGISTRATION", {
      name: input.name,
      phone: input.phone,
    });
  }

  public saveActivation(
    credentials: AuthFlowCredentials,
    input: ActivationPasswordDraftDTO,
  ): Promise<AuthFlowResponseV1> {
    return this._save(credentials, input, "ORDER_ACTIVATION");
  }

  private async _save(
    credentials: AuthFlowCredentials,
    input: ActivationPasswordDraftDTO,
    method: "EMAIL_REGISTRATION" | "ORDER_ACTIVATION",
    profile?: { name: string; phone: string },
  ): Promise<AuthFlowResponseV1> {
    FlowCredentials.validate(credentials);
    if (input.password !== input.passwordConfirm)
      throw new BadRequestException("Passwords do not match");
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM auth_pending_flows WHERE capability_hash = ${FlowCredentials.capabilityHash(credentials)} FOR UPDATE`;
      const flow = await this.store.find(tx, credentials);
      if (!flow)
        throw new UnauthorizedException(
          "Auth continuation is missing or expired",
        );
      const auth = await tx.authAuthenticationFact.findUniqueOrThrow({
        where: { id: flow.authenticationFactId },
      });
      if (auth.method !== method)
        throw new UnauthorizedException("Registration confirmation required");
      const proof = await tx.verifiedIdentityFact.findUniqueOrThrow({
        where: { id: flow.identityFactId },
      });
      const current = await this.directory.byEmail(tx, proof.email);
      if (
        (current?.userId ?? null) !== flow.userIdSnapshot ||
        (current &&
          (current.status !== "active" ||
            current.authVersion !== auth.authVersion))
      )
        throw new ConflictException("Account changed; sign in again");
      const contact = profile
        ? CustomerProfileValues.select(current, profile)
        : undefined;
      if (contact?.missingFields.length)
        throw new BadRequestException("Invalid name or phone");
      const accounts = current
        ? await tx.authAccount.findMany({
            where: { userId: current.userId },
            include: { credential: true },
          })
        : [];
      if (
        this.credentialsAuth.getEnvCredentialBinding(proof.email) ||
        accounts.some(
          (account) => account.credential || account.provider !== "CREDENTIALS",
        )
      )
        throw new ConflictException("Account is already registered; sign in");
      if (flow.credentialPasswordHash) {
        if (
          flow.credentialOperationKey !== input.operationKey ||
          flow.draftName !== (contact?.name ?? null) ||
          flow.draftPhone !== (contact?.phone ?? null) ||
          !(await PasswordHasher.verify(
            input.password,
            flow.credentialPasswordHash,
          ))
        )
          throw new ConflictException("Registration data changed; start again");
        return this.store.state(tx, flow);
      }
      const saved = await tx.authPendingFlow.update({
        where: { id: flow.id },
        data: {
          draftName: contact?.name,
          draftPhone: contact?.phone,
          profileRevision: current?.profileRevision ?? null,
          credentialPasswordHash: await PasswordHasher.create(input.password),
          credentialExpiresAt: flow.expiresAt,
          credentialOperationKey: input.operationKey,
        },
      });
      return this.store.state(tx, saved);
    });
  }
}
