"use server";

import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";

import { routes } from "@/shared/constants";

import type {
  AdminUserDTO,
  UpdateAdminUserRolesInputDTO,
  UpdateAdminUserStatusInputDTO,
  UserRole,
} from "./users.types";

const AUTH_ACCESS_TOKEN_COOKIE_NAME = "artmate_access_token";
const DEFAULT_API_BASE_URL = "http://localhost:3002";

export type AdminUserActionState = {
  readonly description?: string;
  readonly status: "idle" | "success" | "error";
  readonly submittedAt?: number;
  readonly title?: string;
};

export async function getAdminUsers(): Promise<AdminUserDTO[]> {
  return requestAdminApi<AdminUserDTO[]>("/users");
}

export async function updateAdminUserRoles(
  userId: string,
  input: UpdateAdminUserRolesInputDTO,
) {
  return requestAdminApi<AdminUserDTO>(
    `/users/${encodeURIComponent(userId)}/roles`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  );
}

export async function updateAdminUserStatus(
  userId: string,
  input: UpdateAdminUserStatusInputDTO,
) {
  return requestAdminApi<AdminUserDTO>(
    `/users/${encodeURIComponent(userId)}/status`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  );
}

export async function updateAdminUserRolesAction(
  _state: AdminUserActionState,
  formData: FormData,
): Promise<AdminUserActionState> {
  try {
    const userId = getRequiredString(formData.get("userId"));
    const roles = formData
      .getAll("roles")
      .filter(
        (role): role is UserRole => role === "customer" || role === "admin",
      );

    await updateAdminUserRoles(userId, { roles });
    revalidatePath(routes.users);

    return {
      status: "success",
      submittedAt: Date.now(),
      title: "Роли сохранены",
    };
  } catch (error) {
    return {
      description: getActionErrorDescription(error),
      status: "error",
      submittedAt: Date.now(),
      title: "Не удалось сохранить роли",
    };
  }
}

export async function updateAdminUserStatusAction(
  _state: AdminUserActionState,
  formData: FormData,
): Promise<AdminUserActionState> {
  try {
    const userId = getRequiredString(formData.get("userId"));
    const status = getRequiredString(formData.get("status"));

    if (status !== "active" && status !== "blocked") {
      throw new Error("Invalid user status");
    }

    await updateAdminUserStatus(userId, { status });
    revalidatePath(routes.users);

    return {
      status: "success",
      submittedAt: Date.now(),
      title: "Статус пользователя сохранен",
    };
  } catch (error) {
    return {
      description: getActionErrorDescription(error),
      status: "error",
      submittedAt: Date.now(),
      title: "Не удалось изменить статус пользователя",
    };
  }
}

async function requestAdminApi<T>(path: string, init: RequestInit = {}) {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const accessToken = cookieStore.get(AUTH_ACCESS_TOKEN_COOKIE_NAME)?.value;
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      "content-type": "application/json",
      ...(accessToken
        ? {
            cookie: `${AUTH_ACCESS_TOKEN_COOKIE_NAME}=${encodeURIComponent(accessToken)}`,
          }
        : {}),
      ...getForwardedIpHeaders(headerStore),
      ...init.headers,
    },
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }

  return (await response.json()) as T;
}

function getRequiredString(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("Invalid user form data");
  }

  return value;
}

function getActionErrorDescription(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Запрос не выполнен";
}

function getApiBaseUrl() {
  return process.env.API_BASE_URL ?? DEFAULT_API_BASE_URL;
}

function getForwardedIpHeaders(headerStore: Headers) {
  const forwardedFor = headerStore.get("x-forwarded-for");
  const realIp =
    headerStore.get("x-real-ip") ??
    headerStore.get("cf-connecting-ip") ??
    headerStore.get("true-client-ip");

  return {
    ...(forwardedFor ? { "x-forwarded-for": forwardedFor } : {}),
    ...(realIp ? { "x-real-ip": realIp } : {}),
  };
}

async function getErrorMessage(response: Response) {
  const fallback = `Users API request failed with status ${response.status}`;

  try {
    const body = (await response.json()) as {
      message?: unknown;
    };

    if (typeof body.message === "string") {
      return body.message;
    }

    if (Array.isArray(body.message)) {
      return body.message.join(", ");
    }
  } catch {
    return fallback;
  }

  return fallback;
}
