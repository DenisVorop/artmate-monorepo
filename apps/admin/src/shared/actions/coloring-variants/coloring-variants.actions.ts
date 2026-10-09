"use server";

import { cookies, headers } from "next/headers";

import type { ActionResult } from "@/shared/lib/action-result";
import {
  apiCsrfHeader,
  getForwardedIpHeaders,
} from "@/shared/lib/api-security";

import type { ColoringVariantsDTO } from "./coloring-variants.types";

export async function getColoringVariants(
  coloringId: string,
): Promise<ColoringVariantsDTO> {
  const response = await request(coloringId);
  if (!response.ok) throw new Error("Coloring variants request failed");
  return response.json() as Promise<ColoringVariantsDTO>;
}

export async function uploadColoringVariant(
  coloringId: string,
  formData: FormData,
): Promise<ActionResult<ColoringVariantsDTO>> {
  return requestMutation(coloringId, formData);
}

export async function publishColoringVariant(
  coloringId: string,
  target: string,
  input: { expectedToken: string },
): Promise<ActionResult<ColoringVariantsDTO>> {
  return requestMutation(
    coloringId,
    JSON.stringify(input),
    `/${encodeURIComponent(target)}/publish`,
  );
}

async function requestMutation(
  coloringId: string,
  body: FormData | string,
  path = "",
): Promise<ActionResult<ColoringVariantsDTO>> {
  try {
    const response = await request(coloringId, body, path);
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        errorCode?: unknown;
      } | null;
      return {
        ok: false,
        status: response.status,
        error: "Coloring variant request failed",
        ...(typeof payload?.errorCode === "string"
          ? { code: payload.errorCode }
          : {}),
      };
    }
    return { ok: true, data: (await response.json()) as ColoringVariantsDTO };
  } catch {
    return { ok: false, error: "Coloring variant request unavailable" };
  }
}

async function request(
  coloringId: string,
  body?: FormData | string,
  path = "",
) {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const token = cookieStore.get("artmate_access_token")?.value;
  return fetch(
    `${process.env.API_BASE_URL ?? "http://localhost:3002"}/admin/colorings/${encodeURIComponent(coloringId)}/variants${path}`,
    {
      method: body ? "POST" : "GET",
      cache: "no-store",
      ...(body ? { body } : {}),
      headers: {
        ...(token
          ? { cookie: `artmate_access_token=${encodeURIComponent(token)}` }
          : {}),
        ...getForwardedIpHeaders(headerStore),
        ...(typeof body === "string"
          ? { "content-type": "application/json" }
          : {}),
        ...(body ? apiCsrfHeader : {}),
      },
    },
  );
}
