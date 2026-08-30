"use server";

import { Buffer } from "node:buffer";

import { cookies, headers } from "next/headers";

import {
  apiCsrfHeader,
  getForwardedIpHeaders,
} from "@/shared/lib/api-security";

import type {
  ColoringCollectionDTO,
  ColoringDTO,
  ColoringRevisionDTO,
  CreateColoringCollectionInputDTO,
  CreateColoringInputDTO,
  MarkerColorDTO,
  ReviewColoringRevisionInputDTO,
  UpdateColoringCollectionInputDTO,
  UpdateColoringInputDTO,
} from "./colorings.types";

const authAccessTokenCookieName = "artmate_access_token";
const defaultApiBaseUrl = "http://localhost:3002";

export async function getAdminColoringCollections() {
  return requestAdminJson<ColoringCollectionDTO[]>(
    "/admin/coloring-collections",
  );
}

export async function getAdminColoringCollection(collectionId: string) {
  return requestAdminJson<ColoringCollectionDTO>(
    `/admin/coloring-collections/${encodeURIComponent(collectionId)}`,
  );
}

export async function createColoringCollection(
  input: CreateColoringCollectionInputDTO,
) {
  return requestAdminJson<ColoringCollectionDTO>(
    "/admin/coloring-collections",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export async function updateColoringCollection(
  collectionId: string,
  input: UpdateColoringCollectionInputDTO,
) {
  return requestAdminJson<ColoringCollectionDTO>(
    `/admin/coloring-collections/${encodeURIComponent(collectionId)}`,
    { method: "PATCH", body: JSON.stringify(input) },
  );
}

export async function uploadColoringCollectionCover(
  collectionId: string,
  formData: FormData,
) {
  return requestAdminMultipart<ColoringCollectionDTO>(
    `/admin/coloring-collections/${encodeURIComponent(collectionId)}/cover`,
    formData,
  );
}

export async function publishColoringCollection(collectionId: string) {
  return requestAdminJson<ColoringCollectionDTO>(
    `/admin/coloring-collections/${encodeURIComponent(collectionId)}/publish`,
    { method: "POST" },
  );
}

export async function getAdminColorings() {
  return requestAdminJson<ColoringDTO[]>("/admin/colorings");
}

export async function getAdminColoring(coloringId: string) {
  return requestAdminJson<ColoringDTO>(
    `/admin/colorings/${encodeURIComponent(coloringId)}`,
  );
}

export async function createColoring(input: CreateColoringInputDTO) {
  return requestAdminJson<ColoringDTO>("/admin/colorings", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateColoring(
  coloringId: string,
  input: UpdateColoringInputDTO,
) {
  return requestAdminJson<ColoringDTO>(
    `/admin/colorings/${encodeURIComponent(coloringId)}`,
    { method: "PATCH", body: JSON.stringify(input) },
  );
}

export async function getColoringRevisions(coloringId: string) {
  return requestAdminJson<ColoringRevisionDTO[]>(
    `/admin/colorings/${encodeURIComponent(coloringId)}/revisions`,
  );
}

export async function getAdminMarkerColors() {
  return requestAdminJson<MarkerColorDTO[]>("/admin/marker-colors");
}

export async function createColoringRevision(
  coloringId: string,
  formData: FormData,
) {
  return requestAdminMultipart<ColoringRevisionDTO>(
    `/admin/colorings/${encodeURIComponent(coloringId)}/revisions`,
    formData,
  );
}

export async function reviewColoringRevision(
  coloringId: string,
  revisionId: string,
  input: ReviewColoringRevisionInputDTO,
) {
  return requestAdminJson<ColoringRevisionDTO>(
    `/admin/colorings/${encodeURIComponent(coloringId)}/revisions/${encodeURIComponent(revisionId)}/review`,
    { method: "POST", body: JSON.stringify(input) },
  );
}

export async function publishColoringRevision(
  coloringId: string,
  revisionId: string,
) {
  return requestAdminJson<ColoringRevisionDTO>(
    `/admin/colorings/${encodeURIComponent(coloringId)}/revisions/${encodeURIComponent(revisionId)}/publish`,
    { method: "POST" },
  );
}

export async function getProtectedColoringAsset(previewUrl: string) {
  let path: string;

  try {
    path = new URL(previewUrl, "http://coloring-preview.local").pathname;
  } catch {
    throw new Error("Coloring asset preview URL is invalid");
  }

  if (!path.startsWith("/admin/colorings/") || path.includes("\\")) {
    throw new Error("Coloring asset preview URL is invalid");
  }

  const response = await requestAdmin(path);
  const contentType = response.headers.get("content-type")?.split(";", 1)[0];

  if (!contentType?.startsWith("image/")) {
    throw new Error("Coloring asset response is not an image");
  }

  const content = Buffer.from(await response.arrayBuffer()).toString("base64");
  return `data:${contentType};base64,${content}`;
}

async function requestAdminJson<T>(path: string, init: RequestInit = {}) {
  const response = await requestAdmin(path, {
    ...init,
    headers: { "content-type": "application/json", ...init.headers },
  });

  return (await response.json()) as T;
}

async function requestAdminMultipart<T>(path: string, body: FormData) {
  const response = await requestAdmin(path, { method: "POST", body });
  return (await response.json()) as T;
}

async function requestAdmin(path: string, init: RequestInit = {}) {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const accessToken = cookieStore.get(authAccessTokenCookieName)?.value;
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
      ...init.headers,
      ...apiCsrfHeader,
    },
  });

  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response));
  }

  return response;
}

function getApiBaseUrl() {
  return process.env.API_BASE_URL ?? defaultApiBaseUrl;
}

async function getResponseErrorMessage(response: Response) {
  const fallback = `Colorings API request failed with status ${response.status}`;

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
