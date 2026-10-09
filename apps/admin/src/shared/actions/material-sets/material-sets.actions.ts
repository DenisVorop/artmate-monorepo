"use server";

import { cookies, headers } from "next/headers";

import type { ActionResult } from "@/shared/lib/action-result";
import {
  apiCsrfHeader,
  getForwardedIpHeaders,
} from "@/shared/lib/api-security";

import type {
  MaterialSetDetailDTO,
  MaterialSetImportInputDTO,
  MaterialSetImportPreviewDTO,
  MaterialSetSummaryDTO,
} from "./material-sets.types";

export async function getMaterialSets(): Promise<MaterialSetSummaryDTO[]> {
  const result = await request<MaterialSetSummaryDTO[]>("GET");
  if (!result.ok) throw new Error(result.error);
  return result.data;
}

export async function getMaterialSet(
  materialSetId: string,
): Promise<MaterialSetDetailDTO> {
  const result = await request<MaterialSetDetailDTO>(
    "GET",
    `/${encodeURIComponent(materialSetId)}`,
  );
  if (!result.ok) throw new Error(result.error);
  return result.data;
}

export async function previewMaterialSetImport(
  input: MaterialSetImportInputDTO,
): Promise<ActionResult<MaterialSetImportPreviewDTO>> {
  return request("POST", "/import/preview", input);
}

export async function importMaterialSet(
  input: MaterialSetImportInputDTO & { confirmationHash: string },
): Promise<ActionResult<MaterialSetSummaryDTO>> {
  return request("POST", "/import", input);
}

async function request<T>(
  method: "GET" | "POST",
  path = "",
  input?: MaterialSetImportInputDTO & { confirmationHash?: string },
): Promise<ActionResult<T>> {
  try {
    const cookieStore = await cookies();
    const headerStore = await headers();
    const token = cookieStore.get("artmate_access_token")?.value;
    const response = await fetch(
      `${process.env.API_BASE_URL ?? "http://localhost:3002"}/admin/material-sets${path}`,
      {
        method,
        cache: "no-store",
        ...(input ? { body: JSON.stringify(input) } : {}),
        headers: {
          ...(token
            ? { cookie: `artmate_access_token=${encodeURIComponent(token)}` }
            : {}),
          ...getForwardedIpHeaders(headerStore),
          ...(method === "POST"
            ? { "content-type": "application/json", ...apiCsrfHeader }
            : {}),
        },
      },
    );
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: "Material sets request failed",
      };
    }
    return { ok: true, data: (await response.json()) as T };
  } catch {
    return { ok: false, error: "Material sets request unavailable" };
  }
}
