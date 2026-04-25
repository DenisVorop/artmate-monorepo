import type { AuthSessionDTO, AuthUserDTO } from "@/shared/actions/auth";

export type AuthUser = AuthUserDTO;

export type AuthSession = AuthSessionDTO;

export type SessionResult = AuthSession | null;
