"use server";

import { cookies, headers } from "next/headers";

import { formatColoringNumber } from "@/shared/constants";
import { ApiResult, type ApiResultDTO } from "@/shared/lib/api-result";
import { apiCsrfHeader, getForwardedIpHeaders } from "@/shared/lib/api-security";

import type {
  AddWorkshopCollectionInput,
  CreateWorkshopRevisionInput,
  ReportCommunityWorkInput,
  SaveWorkshopToolInput,
  UpdateWorkshopVisibilityInput,
} from "./workshops.types";

const authAccessTokenCookieName = "artmate_access_token";
const defaultApiBaseUrl = "http://localhost:3002";
const maxAssetBytes = 20 * 1024 * 1024;
const imageContentTypePattern = /^image\/(?:jpeg|png|webp)$/i;

class WorkshopsApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "WorkshopsApiError";
    this.status = status;
  }
}

export async function getMyWorkshop(): Promise<ApiResultDTO<unknown>> {
  return requestResult(() => requestJson("/workshops/me"));
}

export async function updateMyWorkshopVisibility(
  input: UpdateWorkshopVisibilityInput,
): Promise<ApiResultDTO<unknown>> {
  return requestResult(() =>
    requestJson("/workshops/me/visibility", {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  );
}

export async function addMyWorkshopCollection(
  input: AddWorkshopCollectionInput,
): Promise<ApiResultDTO<unknown>> {
  return requestResult(() =>
    requestJson("/workshops/me/collections", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  );
}

export async function getMyWorkshopCollection(slug: string): Promise<ApiResultDTO<unknown>> {
  return requestResult(() => requestJson(`/workshops/me/collections/${encodeURIComponent(slug)}`));
}

export async function getMyWorkshopColoring(
  slug: string,
  number: number,
): Promise<ApiResultDTO<unknown>> {
  return requestResult(() =>
    requestJson(
      `/workshops/me/collections/${encodeURIComponent(slug)}/colorings/${formatColoringNumber(number)}`,
    ),
  );
}

export async function createMyWorkshopRevision(
  slug: string,
  number: number,
  input: CreateWorkshopRevisionInput,
): Promise<ApiResultDTO<unknown>> {
  const formData = new FormData();

  if (input.photo) {
    formData.append("photo", input.photo);
  }

  formData.append(
    "payload",
    JSON.stringify({
      caption: input.caption,
      publicationConsent: input.publicationConsent,
      advertisingConsent: input.advertisingConsent,
      crop: input.crop,
      materials: input.materials,
      symbolMappings: input.symbolMappings,
    }),
  );

  return requestResult(() =>
    requestJson(
      `/workshops/me/collections/${encodeURIComponent(slug)}/colorings/${formatColoringNumber(number)}/revisions`,
      { method: "POST", body: formData },
    ),
  );
}

export async function publishMyWorkshopWork(workId: string): Promise<ApiResultDTO<unknown>> {
  return requestResult(() =>
    requestJson(`/workshops/me/works/${encodeURIComponent(workId)}/publish`, { method: "POST" }),
  );
}

export async function unpublishMyWorkshopWork(workId: string): Promise<ApiResultDTO<unknown>> {
  return requestResult(() =>
    requestJson(`/workshops/me/works/${encodeURIComponent(workId)}/unpublish`, { method: "POST" }),
  );
}

export async function deleteMyWorkshopWork(workId: string): Promise<ApiResultDTO<unknown>> {
  return requestResult(() =>
    requestJson(`/workshops/me/works/${encodeURIComponent(workId)}`, { method: "DELETE" }),
  );
}

export async function getMyWorkshopTools(): Promise<ApiResultDTO<unknown>> {
  return requestResult(() => requestJson("/workshops/me/tools"));
}

export async function saveMyWorkshopTool(
  input: SaveWorkshopToolInput,
): Promise<ApiResultDTO<unknown>> {
  return requestResult(() =>
    requestJson("/workshops/me/tools", { method: "POST", body: JSON.stringify(input) }),
  );
}

export async function getWorkshopMarkerColors(): Promise<ApiResultDTO<unknown>> {
  return requestResult(() => requestJson("/workshops/marker-colors"));
}

export async function getOwnerRevisionAssetDataUrl(
  revisionId: string,
  variant: "normalized" | "web" | "thumb",
): Promise<ApiResultDTO<string>> {
  return requestResult(() =>
    requestAssetDataUrl(
      `/workshops/me/revisions/${encodeURIComponent(revisionId)}/assets/${variant}`,
    ),
  );
}

export async function getPublicWorkshop(handle: string): Promise<ApiResultDTO<unknown>> {
  return requestResult(() => requestJson(`/club/${encodeURIComponent(handle)}`));
}

export async function getPublicCommunityWork(publicId: string): Promise<ApiResultDTO<unknown>> {
  return requestResult(() => requestJson(`/club/works/${encodeURIComponent(publicId)}`));
}

export async function getCommunityWorksForColoring(
  slug: string,
  number: number,
): Promise<ApiResultDTO<unknown>> {
  return requestResult(() =>
    requestJson(
      `/club/colorings/${encodeURIComponent(slug)}/${formatColoringNumber(number)}/works`,
    ),
  );
}

export async function reportCommunityWork(
  publicId: string,
  input: ReportCommunityWorkInput,
): Promise<ApiResultDTO<unknown>> {
  return requestResult(() =>
    requestJson(`/club/works/${encodeURIComponent(publicId)}/reports`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  );
}

export async function getPublicWorkAssetDataUrl(
  publicId: string,
  variant: "web" | "thumb",
): Promise<ApiResultDTO<string>> {
  return requestResult(() =>
    requestAssetDataUrl(`/club/works/${encodeURIComponent(publicId)}/assets/${variant}`),
  );
}

async function requestResult<T>(request: () => Promise<T>): Promise<ApiResultDTO<T>> {
  const result = await ApiResult.prepareApi(request, { isEmptyCb: () => false })();
  const dto = result.toDTO() as ApiResultDTO<T>;

  if (!dto.error) {
    return dto;
  }

  const error = { ...dto.error };
  delete (error as { stack?: unknown }).stack;

  return { ...dto, error };
}

async function requestJson(path: string, init: RequestInit = {}): Promise<unknown> {
  const response = await requestWorkshopsApi(path, init);

  if (response.status === 204) {
    return null;
  }

  try {
    return await response.json();
  } catch {
    throw new WorkshopsApiError("Workshops API returned invalid JSON", 502);
  }
}

async function requestAssetDataUrl(path: string): Promise<string> {
  const response = await requestWorkshopsApi(path);
  const contentType = response.headers.get("content-type")?.split(";")[0]?.trim() ?? "";

  if (!imageContentTypePattern.test(contentType)) {
    throw new WorkshopsApiError("Workshops API returned an unsupported image", 502);
  }

  const contentLength = response.headers.get("content-length");
  const declaredBytes = contentLength === null ? Number.NaN : Number(contentLength);

  if (Number.isFinite(declaredBytes) && declaredBytes > maxAssetBytes) {
    throw new WorkshopsApiError("Workshop image is too large", 502);
  }

  const bytes = await response.arrayBuffer();

  if (bytes.byteLength > maxAssetBytes) {
    throw new WorkshopsApiError("Workshop image is too large", 502);
  }

  return `data:${contentType};base64,${Buffer.from(bytes).toString("base64")}`;
}

async function requestWorkshopsApi(path: string, init: RequestInit = {}) {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const accessToken = cookieStore.get(authAccessTokenCookieName)?.value;
  const method = (init.method ?? "GET").toUpperCase();
  const isUnsafeMethod = method !== "GET" && method !== "HEAD";
  const isMultipart = init.body instanceof FormData;
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      ...(accessToken
        ? { cookie: `${authAccessTokenCookieName}=${encodeURIComponent(accessToken)}` }
        : {}),
      ...(!isMultipart && init.body ? { "content-type": "application/json" } : {}),
      ...getForwardedIpHeaders(headerStore),
      ...(isUnsafeMethod ? apiCsrfHeader : {}),
      ...init.headers,
    },
  });

  if (!response.ok) {
    throw new WorkshopsApiError(await getErrorMessage(response), response.status);
  }

  return response;
}

function getApiBaseUrl() {
  return process.env.API_BASE_URL ?? defaultApiBaseUrl;
}

async function getErrorMessage(response: Response) {
  const fallback = `Workshops API request failed with status ${response.status}`;

  try {
    const body = (await response.json()) as { message?: unknown };

    if (typeof body.message === "string") {
      return body.message;
    }

    if (Array.isArray(body.message)) {
      return body.message.filter((item): item is string => typeof item === "string").join(", ");
    }
  } catch {
    return fallback;
  }

  return fallback;
}
