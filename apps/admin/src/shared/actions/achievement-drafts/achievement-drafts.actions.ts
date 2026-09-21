"use server";

import { cookies, headers } from "next/headers";

import {
  apiCsrfHeader,
  getForwardedIpHeaders,
} from "@/shared/lib/api-security";
import type { ActionResult } from "@/shared/lib/action-result";

import type {
  ActivateAchievementDraftInputDTO,
  AchievementDraftDTO,
  AchievementImageUploadDTO,
  ArchiveAchievementDraftInputDTO,
  CreateAchievementDraftInputDTO,
  UpdateAchievementDraftInputDTO,
} from "./achievement-drafts.types";

const authAccessTokenCookieName = "artmate_access_token";
const defaultApiBaseUrl = "http://localhost:3002";

class AchievementDraftApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "AchievementDraftApiError";
  }
}

export async function getAchievementDrafts(): Promise<AchievementDraftDTO[]> {
  return requestAdminApi<AchievementDraftDTO[]>("/loyalty/admin/achievements");
}

export async function createAchievementDraft(
  input: CreateAchievementDraftInputDTO,
): Promise<ActionResult<AchievementDraftDTO>> {
  return requestMutation(() =>
    requestAdminApi<AchievementDraftDTO>("/loyalty/admin/achievements", {
      body: JSON.stringify(input),
      method: "POST",
    }),
  );
}

export async function updateAchievementDraft(
  achievementId: string,
  input: UpdateAchievementDraftInputDTO,
): Promise<ActionResult<AchievementDraftDTO>> {
  return requestMutation(() =>
    requestAdminApi<AchievementDraftDTO>(
      `/loyalty/admin/achievements/${encodeURIComponent(achievementId)}`,
      {
        body: JSON.stringify(input),
        method: "PATCH",
      },
    ),
  );
}

export async function archiveAchievementDraft(
  achievementId: string,
  input: ArchiveAchievementDraftInputDTO,
): Promise<ActionResult<AchievementDraftDTO>> {
  return requestMutation(() =>
    requestAdminApi<AchievementDraftDTO>(
      `/loyalty/admin/achievements/${encodeURIComponent(achievementId)}/archive`,
      {
        body: JSON.stringify(input),
        method: "POST",
      },
    ),
  );
}

export async function activateAchievementDraft(
  achievementId: string,
  input: ActivateAchievementDraftInputDTO,
): Promise<ActionResult<AchievementDraftDTO>> {
  return requestMutation(() =>
    requestAdminApi<AchievementDraftDTO>(
      `/loyalty/admin/achievements/${encodeURIComponent(achievementId)}/activate`,
      {
        body: JSON.stringify(input),
        method: "POST",
      },
    ),
  );
}

export async function uploadAchievementImage(
  formData: FormData,
): Promise<ActionResult<AchievementImageUploadDTO>> {
  return requestMutation(() =>
    requestAdminApi<AchievementImageUploadDTO>(
      "/loyalty/admin/achievements/images",
      {
        body: formData,
        method: "POST",
      },
    ),
  );
}

async function requestMutation<T>(
  request: () => Promise<T>,
): Promise<ActionResult<T>> {
  try {
    return { data: await request(), ok: true };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Не удалось выполнить запрос",
      ok: false,
      status:
        error instanceof AchievementDraftApiError ? error.status : undefined,
    };
  }
}

async function requestAdminApi<T>(path: string, init: RequestInit = {}) {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const accessToken = cookieStore.get(authAccessTokenCookieName)?.value;
  const response = await fetch(
    `${process.env.API_BASE_URL ?? defaultApiBaseUrl}${path}`,
    {
      ...init,
      cache: "no-store",
      headers: {
        ...(accessToken
          ? {
              cookie: `${authAccessTokenCookieName}=${encodeURIComponent(accessToken)}`,
            }
          : {}),
        ...(init.body && !(init.body instanceof FormData)
          ? { "content-type": "application/json" }
          : {}),
        ...getForwardedIpHeaders(headerStore),
        ...init.headers,
        ...((init.method ?? "GET").toUpperCase() === "GET"
          ? {}
          : apiCsrfHeader),
      },
    },
  );

  if (!response.ok) {
    throw new AchievementDraftApiError(
      await getResponseErrorMessage(response),
      response.status,
    );
  }

  return (await response.json()) as T;
}

async function getResponseErrorMessage(response: Response) {
  const fallback = `Achievements API request failed with status ${response.status}`;

  try {
    const body = (await response.json()) as { message?: unknown };

    if (typeof body.message === "string") return body.message;
    if (Array.isArray(body.message)) return body.message.join(", ");
  } catch {
    return fallback;
  }

  return fallback;
}
