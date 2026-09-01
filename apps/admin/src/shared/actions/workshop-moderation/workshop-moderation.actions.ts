"use server";

import { Buffer } from "node:buffer";

import { cookies, headers } from "next/headers";

import {
  apiCsrfHeader,
  getForwardedIpHeaders,
} from "@/shared/lib/api-security";

import {
  workshopModerationDecisionSchema,
  workshopModerationDetailSchema,
  workshopModerationQueueSchema,
  workshopModerationRevisionIdSchema,
  workshopModerationStatusSchema,
  workshopModerationVariantSchema,
} from "./workshop-moderation.schemas";
import { WorkshopModerationApiError } from "./workshop-moderation.errors";
import type {
  WorkshopModerationDecisionInputDTO,
  WorkshopModerationDetailDTO,
  WorkshopModerationQueueDTO,
  WorkshopModerationStatusDTO,
} from "./workshop-moderation.types";

const authAccessTokenCookieName = "artmate_access_token";
const defaultApiBaseUrl = "http://localhost:3002";
const maxProtectedAssetBytes = 25_000_000;

export async function getWorkshopModerationQueue(
  status: WorkshopModerationStatusDTO,
): Promise<WorkshopModerationQueueDTO> {
  const safeStatus = workshopModerationStatusSchema.parse(status);
  const response = await requestAdmin(
    `/admin/workshop-moderation?status=${encodeURIComponent(safeStatus)}`,
  );

  return workshopModerationQueueSchema.parse(await response.json());
}

export async function getWorkshopModerationDetail(
  revisionId: string,
): Promise<WorkshopModerationDetailDTO> {
  const safeRevisionId = workshopModerationRevisionIdSchema.parse(revisionId);
  const response = await requestAdmin(
    `/admin/workshop-moderation/${encodeURIComponent(safeRevisionId)}`,
  );

  return workshopModerationDetailSchema.parse(await response.json());
}

export async function decideWorkshopModerationRevision(
  revisionId: string,
  input: WorkshopModerationDecisionInputDTO,
): Promise<WorkshopModerationDetailDTO> {
  const safeRevisionId = workshopModerationRevisionIdSchema.parse(revisionId);
  const safeInput = workshopModerationDecisionSchema.parse(input);
  const response = await requestAdmin(
    `/admin/workshop-moderation/${encodeURIComponent(safeRevisionId)}/decision`,
    {
      body: JSON.stringify(safeInput),
      method: "POST",
    },
  );

  return workshopModerationDetailSchema.parse(await response.json());
}

export async function getWorkshopModerationAsset(
  revisionId: string,
  variant: "normalized" | "web" | "thumb" | "official",
) {
  const safeRevisionId = workshopModerationRevisionIdSchema.parse(revisionId);
  const safeVariant = workshopModerationVariantSchema.parse(variant);
  const response = await requestAdmin(
    `/admin/workshop-moderation/${encodeURIComponent(safeRevisionId)}/assets/${encodeURIComponent(safeVariant)}`,
  );
  const contentType = response.headers.get("content-type")?.split(";", 1)[0];

  if (
    !contentType ||
    !["image/jpeg", "image/png", "image/webp"].includes(contentType)
  ) {
    throw new Error(
      "Workshop moderation asset response is not a supported image",
    );
  }

  const declaredLength = Number(response.headers.get("content-length"));

  if (Number.isFinite(declaredLength) && declaredLength > maxProtectedAssetBytes) {
    throw new Error("Workshop moderation asset exceeds the size limit");
  }

  const content = Buffer.from(await response.arrayBuffer());

  if (content.byteLength > maxProtectedAssetBytes) {
    throw new Error("Workshop moderation asset exceeds the size limit");
  }

  return `data:${contentType};base64,${content.toString("base64")}`;
}

async function requestAdmin(path: string, init: RequestInit = {}) {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const accessToken = cookieStore.get(authAccessTokenCookieName)?.value;
  const method = (init.method ?? "GET").toUpperCase();
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      ...(accessToken
        ? {
            cookie: `${authAccessTokenCookieName}=${encodeURIComponent(accessToken)}`,
          }
        : {}),
      ...getForwardedIpHeaders(headerStore),
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...init.headers,
      ...(method === "POST" ? apiCsrfHeader : {}),
    },
  });

  if (!response.ok) {
    throw new WorkshopModerationApiError(
      await getResponseErrorMessage(response),
      response.status,
    );
  }

  return response;
}

function getApiBaseUrl() {
  return process.env.API_BASE_URL ?? defaultApiBaseUrl;
}

async function getResponseErrorMessage(response: Response) {
  const fallback = `Workshop moderation API request failed with status ${response.status}`;

  try {
    const body = (await response.json()) as { message?: unknown };

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
